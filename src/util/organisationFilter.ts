import { SelectQueryBuilder } from 'typeorm';
import { UserRole } from './constants';
import { AppDataSource } from '../data-source';
import { AccountManager } from '../entity/AccountManager.entity';
import { AccountManagerOrganisation } from '../entity/AccountManagerOrganisation.entity';
import { UserOrganisation } from '../entity/UserOrganisation.entity';
import { Centre } from '../entity/Centre.entity';
import { Employer } from '../entity/Employer.entity';
import { UserCentre } from '../entity/UserCentre.entity';
import { In } from 'typeorm';

/**
 * Get accessible organisation IDs for a user - fetches fresh from database
 * @param user - User object from request (req.user)
 * @returns null if MasterAdmin (all access), array of IDs otherwise
 */
/** Normalise role from user (single role or roles array). Exported for controllers/middleware. */
export function resolveUserRole(user: any): string | undefined {
    if (user?.role) return user.role;
    if (Array.isArray(user?.roles) && user.roles.length) return user.roles[0];
    return undefined;
}

export async function getAccessibleOrganisationIds(user: any): Promise<number[] | null> {
    const role = resolveUserRole(user);
    if (role === UserRole.MasterAdmin) {
        return null; // All access
    }

    if (role === UserRole.AccountManager) {
        // Fetch fresh from database for AccountManager
        const accountManagerRepository = AppDataSource.getRepository(AccountManager);
        const amoRepository = AppDataSource.getRepository(AccountManagerOrganisation);

        const accountManager = await accountManagerRepository.findOne({
            where: { user_id: user.user_id }
        });

        if (accountManager) {
            const assignments = await amoRepository.find({
                where: { account_manager_id: accountManager.id }
            });
            return assignments.map(a => a.organisation_id);
        }
        return [];
    }

    if (role === UserRole.OrganisationAdmin) {
        // OrganisationAdmin: get their organisation_id from UserOrganisation (should be single org)
        const userOrganisationRepository = AppDataSource.getRepository(UserOrganisation);
        const userOrganisations = await userOrganisationRepository.find({
            where: { user_id: user.user_id }
        });
        return userOrganisations.map(uo => uo.organisation_id);
    }
    if (role === UserRole.CentreAdmin) {
        const userCentreRepository = AppDataSource.getRepository(UserCentre);
        const centreRepository = AppDataSource.getRepository(Centre);

        const userCentres = await userCentreRepository.find({
            where: { user_id: user.user_id }
        });
        if (!userCentres.length) {
            return [];
        }

        const centreIds = userCentres.map(uc => uc.centre_id);
        const centres = await centreRepository.find({
            where: { id: In(centreIds) }
        });
        const orgIds = [...new Set(centres.map(c => c.organisation_id))];
        return orgIds;
    }
    // For other roles (including CentreAdmin), fetch from UserOrganisation
    const userOrganisationRepository = AppDataSource.getRepository(UserOrganisation);
    const userOrganisations = await userOrganisationRepository.find({
        where: { user_id: user.user_id }
    });
    return userOrganisations.map(uo => uo.organisation_id);
}

/**
 * Get accessible centre IDs for a user.
 * - MasterAdmin: null (all centres).
 * - If user is assigned to specific centre(s) via centre_admins: return only those centre IDs (centre-scoped).
 * - Otherwise (org-scoped): return all centre IDs that belong to the user's accessible organisations.
 * @param user - User object from request (req.user)
 * @returns null if MasterAdmin (all access), array of centre IDs otherwise
 */
export async function getAccessibleCentreIds(user: any): Promise<number[] | null> {
    const role = resolveUserRole(user);
    if (role === UserRole.MasterAdmin) {
        return null;
    }

    const centreRepository = AppDataSource.getRepository(Centre);
    const userCentreRepository = AppDataSource.getRepository(UserCentre);

    // First, check if the user has explicit centre assignments via user_centres
    const userCentreRows = await userCentreRepository.find({
        where: { user_id: user.user_id }
    });

    if (userCentreRows.length > 0) {
        // Centre-scoped: only these centres
        const centreIds = [...new Set(userCentreRows.map(uc => uc.centre_id))];
        return centreIds;
    }

    // Otherwise, org-scoped: all centres in accessible organisations
    const orgIds = await getAccessibleOrganisationIds(user);
    if (orgIds === null) return null;
    if (orgIds.length === 0) return [];

    const centresInOrgs = await centreRepository
        .createQueryBuilder('centre')
        .where('centre.deleted_at IS NULL')
        .andWhere('centre.organisation_id IN (:...orgIds)', { orgIds })
        .select('centre.id')
        .getMany();

    return centresInOrgs.map(c => c.id);
}

/**
 * Get accessible user IDs for filtering entities that are scoped by user (e.g. CPD, RiskRating trainer).
 * - MasterAdmin: null (all users).
 * - CentreAdmin: user IDs assigned to their centres via UserCentre.
 * - OrganisationAdmin / AccountManager: user IDs in their organisation(s) via UserOrganisation.
 */
export async function getAccessibleUserIds(user: any): Promise<number[] | null> {
    const role = resolveUserRole(user);
    if (role === UserRole.MasterAdmin) return null;

    if (role === UserRole.CentreAdmin) {
        return getAccessibleCentreAdminUserIds(user);
    }

    const orgIds = await getAccessibleOrganisationIds(user);
    if (orgIds === null) return null;
    if (orgIds.length === 0) return [];

    const userOrgRepository = AppDataSource.getRepository(UserOrganisation);
    const rows = await userOrgRepository
        .createQueryBuilder('uo')
        .select('DISTINCT uo.user_id', 'user_id')
        .where('uo.organisation_id IN (:...orgIds)', { orgIds })
        .getRawMany();
    return rows.map((r: { user_id: number }) => r.user_id);
}

/**
 * When user is centre-scoped (assigned to specific centre(s) via centre_admins), returns the list of
 * user_ids that are admins of those centres. Used to restrict Learners, CPD, Assignments, Sessions, etc.
 * to only data where the relevant user (e.g. trainer, CPD owner) is in this set.
 * Returns null when user is MasterAdmin or org-scoped (no extra centre-level user filter).
 */
export async function getAccessibleCentreAdminUserIds(user: any): Promise<number[] | null> {
    const role = resolveUserRole(user);
    if (role === UserRole.MasterAdmin) {
        return null;
    }

    const userCentreRepository = AppDataSource.getRepository(UserCentre);

    // Get centres this user is assigned to
    const userCentres = await userCentreRepository.find({
        where: { user_id: user.user_id }
    });

    if (userCentres.length === 0) {
        return null; // Org-scoped: no centre-level user filter
    }

    const centreIds = [...new Set(userCentres.map(uc => uc.centre_id))];

    // Get all users assigned to these centres
    const rows = await userCentreRepository
        .createQueryBuilder('uc')
        .select('DISTINCT uc.user_id', 'user_id')
        .where('uc.centre_id IN (:...centreIds)', { centreIds })
        .getRawMany();

    const userIds = rows.map((r: { user_id: number }) => r.user_id);
    return userIds.length ? userIds : [];
}

/**
 * Add centre filter to query builder.
 * Use for entities that have a centre_id column (e.g. AuditLog, Centre list).
 * @param qb - TypeORM QueryBuilder
 * @param user - User object from request
 * @param centreColumn - Column name for centre_id (default: 'centre_id'); use alias e.g. 'centre.id' for Centre entity
 */
export async function addCentreFilter(
    qb: SelectQueryBuilder<any>,
    user: any,
    centreColumn: string = 'centre_id'
): Promise<void> {
    const accessibleCentreIds = await getAccessibleCentreIds(user);

    if (accessibleCentreIds === null) {
        return;
    }

    if (accessibleCentreIds.length === 0) {
        qb.andWhere('1 = 0');
        return;
    }

    qb.andWhere(`${centreColumn} IN (:...centreIds)`, { centreIds: accessibleCentreIds });
}

/**
 * Check whether the user can access the given organisation (for single-resource checks).
 */
export async function canAccessOrganisation(user: any, organisationId: number): Promise<boolean> {
    const ids = await getAccessibleOrganisationIds(user);
    if (ids === null) return true;
    return ids.includes(organisationId);
}

/**
 * Check whether the user can access the given centre (for single-resource checks).
 */
export async function canAccessCentre(user: any, centreId: number): Promise<boolean> {
    const ids = await getAccessibleCentreIds(user);
    if (ids === null) return true;
    return ids.includes(centreId);
}

/**
 * Add organization filter to query builder
 * @param qb - TypeORM QueryBuilder
 * @param user - User object from request
 * @param organisationColumn - Column name for organisation_id (default: 'organisation_id')
 */
export async function addOrganisationFilter(
    qb: SelectQueryBuilder<any>,
    user: any,
    organisationColumn: string = 'organisation_id'
): Promise<void> {
    const accessibleIds = await getAccessibleOrganisationIds(user);

    if (accessibleIds === null) {
        // MasterAdmin - no filter needed
        return;
    }

    if (accessibleIds.length === 0) {
        // No organizations assigned - return empty result
        qb.andWhere(`1 = 0`); // Always false condition
        return;
    }

    qb.andWhere(`${organisationColumn} IN (:...ids)`, { ids: accessibleIds });
}

/**
 * Filter users by their organization assignments
 * This is a special case since users are filtered through UserOrganisation junction table
 * @param qb - TypeORM QueryBuilder for User entity
 * @param user - User object from request
 */
export async function addUserOrganisationFilter(
    qb: SelectQueryBuilder<any>,
    user: any
): Promise<void> {
    const accessibleIds = await getAccessibleOrganisationIds(user);

    if (accessibleIds === null) {
        // MasterAdmin - no filter needed
        return;
    }

    if (accessibleIds.length === 0) {
        // No organizations assigned - return empty result
        qb.andWhere(`1 = 0`); // Always false condition
        return;
    }

    // Join with UserOrganisation and filter by organisation_id
    qb.leftJoin('user.userOrganisations', 'userOrganisation')
        .andWhere('userOrganisation.organisation_id IN (:...ids)', { ids: accessibleIds });
}

/**
 * Apply scope to User list query based on role. Use for User List API only.
 * - MasterAdmin: no filter.
 * - OrganisationAdmin: users in their organisation(s) via UserOrganisation.
 * - CentreAdmin: only users assigned to their centre(s) via UserCentre (no cross-centre).
 * - AccountManager: users in their assigned organisation(s) via UserOrganisation.
 * @param qb - TypeORM QueryBuilder for User entity (alias must be 'user' or pass userAlias)
 * @param user - User object from request (req.user)
 * @param userAlias - Alias of the User entity in the query (default 'user')
 */
export async function addUserScopeFilter(
    qb: SelectQueryBuilder<any>,
    user: any,
    userAlias: string = 'user'
): Promise<void> {
    const role = resolveUserRole(user);

    if (role === UserRole.MasterAdmin) {
        return;
    }

    if (role === UserRole.CentreAdmin) {
        const centreIds = await getAccessibleCentreIds(user);
        if (centreIds === null || centreIds.length === 0) {
            qb.andWhere('1 = 0');
            return;
        }
        // Only users that have at least one UserCentre row for the admin's assigned centres
        qb.andWhere(
            `${userAlias}.user_id IN (SELECT uc.user_id FROM user_centres uc WHERE uc.centre_id IN (:...centreIds))`,
            { centreIds }
        );
        return;
    }

    // OrganisationAdmin, AccountManager, and fallback: filter by organisation via UserOrganisation
    const accessibleIds = await getAccessibleOrganisationIds(user);
    if (accessibleIds === null) return;
    if (accessibleIds.length === 0) {
        qb.andWhere('1 = 0');
        return;
    }
    qb.leftJoin(`${userAlias}.userOrganisations`, 'userOrganisation')
        .andWhere('userOrganisation.organisation_id IN (:...ids)', { ids: accessibleIds });
}

export type ScopeOptions = {
    /** Column for organisation_id (default: entityAlias.organisation_id) */
    organisationColumn?: string;
    /** Column for centre_id (default: entityAlias.centre_id). Set to null or use organisationOnly for entities without centre (e.g. Employer). */
    centreColumn?: string | null;
    /** When true, only organisation filter is applied (no centre filter). Use for Employer and other org-only entities. */
    organisationOnly?: boolean;
};

/**
 * Central scope helper - apply organisation/centre filters based on user role.
 * Use in every query builder. Do not duplicate filtering logic in controllers.
 *
 * Rules:
 * - MasterAdmin: no filter.
 * - OrganisationAdmin: WHERE entity.organisation_id = user's org(s).
 * - CentreAdmin: WHERE entity.centre_id IN assignedCentreIds (or org filter if organisationOnly).
 * - AccountManager: WHERE entity.organisation_id IN assignedOrgIds.
 *
 * @param qb - TypeORM QueryBuilder
 * @param user - User object from request (req.user)
 * @param entityAlias - Alias of the main entity in the query (e.g. 'learner', 'employer', 'centre')
 * @param options - organisationColumn, centreColumn, or organisationOnly (for entities without centre_id)
 */
export async function applyScope(
    qb: SelectQueryBuilder<any>,
    user: any,
    entityAlias: string = 'learner',
    options?: ScopeOptions
): Promise<void> {
    const orgCol = options?.organisationColumn ?? `${entityAlias}.organisation_id`;
    const applyCentre = options?.organisationOnly !== true && options?.centreColumn !== null;
    const centreCol = options?.centreColumn ?? `${entityAlias}.centre_id`;

    const role = resolveUserRole(user);

    if (role === UserRole.MasterAdmin) {
        return;
    }

    if (role === UserRole.OrganisationAdmin) {
        const orgIds = await getAccessibleOrganisationIds(user);
        if (orgIds === null || orgIds.length === 0) {
            qb.andWhere('1 = 0');
            return;
        }
        qb.andWhere(`${orgCol} IN (:...orgIds)`, { orgIds });
        return;
    }

    if (role === UserRole.CentreAdmin) {
        if (applyCentre) {
            const centreIds = await getAccessibleCentreIds(user);
            if (centreIds === null || centreIds.length === 0) {
                qb.andWhere('1 = 0');
                return;
            }
            qb.andWhere(`${centreCol} IN (:...centreIds)`, { centreIds });
        } else {
            const orgIds = await getAccessibleOrganisationIds(user);
            if (orgIds === null || orgIds.length === 0) {
                qb.andWhere('1 = 0');
                return;
            }
            qb.andWhere(`${orgCol} IN (:...orgIds)`, { orgIds });
        }
        return;
    }

    if (role === UserRole.AccountManager) {
        const orgIds = await getAccessibleOrganisationIds(user);
        if (orgIds === null || orgIds.length === 0) {
            qb.andWhere('1 = 0');
            return;
        }
        qb.andWhere(`${orgCol} IN (:...orgIds)`, { orgIds });
        return;
    }

    // Other roles: organisation filter only
    const orgIds = await getAccessibleOrganisationIds(user);
    if (orgIds === null) return;
    if (orgIds.length === 0) {
        qb.andWhere('1 = 0');
        return;
    }
    qb.andWhere(`${orgCol} IN (:...orgIds)`, { orgIds });
}

/**
 * Apply scope filter to entities that are scoped by user_id (e.g. CPD, RiskRating trainer_id).
 * Adds WHERE userIdColumn IN (accessible user IDs). Use when entity has no organisation_id/centre_id.
 */
export async function applyUserScopedFilter(
    qb: SelectQueryBuilder<any>,
    user: any,
    userIdColumn: string
): Promise<void> {
    const userIds = await getAccessibleUserIds(user);
    if (userIds === null) return;
    if (userIds.length === 0) {
        qb.andWhere('1 = 0');
        return;
    }
    qb.andWhere(`${userIdColumn} IN (:...userIds)`, { userIds });
}

/**
 * Apply scope filter to Learner query builder. Wraps applyScope with learner-specific logic.
 */
export async function applyLearnerScope(
    qb: SelectQueryBuilder<any>,
    user: any,
    learnerAlias: string = 'learner'
): Promise<void> {
    const role = resolveUserRole(user);
    if (role === UserRole.MasterAdmin) return;

    if (role === UserRole.OrganisationAdmin || role === UserRole.AccountManager || role === UserRole.CentreAdmin) {
        return applyScope(qb, user, learnerAlias);
    }

    // For other roles: join via UserOrganisation (learners may not have organisation_id yet)
    const orgIds = await getAccessibleOrganisationIds(user);
    if (orgIds === null) return;
    if (orgIds.length === 0) {
        qb.andWhere('1 = 0');
        return;
    }
    qb.leftJoin(`${learnerAlias}.user_id`, 'learnerUser')
        .leftJoin('learnerUser.userOrganisations', 'userOrganisation')
        .andWhere('userOrganisation.organisation_id IN (:...orgIds)', { orgIds });

    const centreAdminUserIds = await getAccessibleCentreAdminUserIds(user);
    if (centreAdminUserIds !== null && centreAdminUserIds.length > 0) {
        qb.andWhere(
            `${learnerAlias}.learner_id IN (SELECT uc.learner_id FROM user_course uc WHERE uc.trainer_id IN (:...centreAdminUserIds))`,
            { centreAdminUserIds }
        );
    }
}

/**
 * Validate that centre belongs to organisation
 */
export async function validateCentreOrganisation(centreId: number, organisationId: number): Promise<boolean> {
    const centreRepository = AppDataSource.getRepository(Centre);
    const centre = await centreRepository.findOne({
        where: { id: centreId },
        relations: ['organisation']
    });

    if (!centre) return false;
    return centre.organisation_id === organisationId;
}

/**
 * Validate that employer belongs to organisation
 */
export async function validateEmployerOrganisation(employerId: number, organisationId: number): Promise<boolean> {
    const employerRepository = AppDataSource.getRepository(Employer);
    const employer = await employerRepository.findOne({
        where: { employer_id: employerId }
    });

    if (!employer) return false;
    return employer.organisation_id === organisationId;
}

/**
 * Validate learner organisation, centre, and employer relationships
 * - centre.organisation_id must match learner.organisation_id
 * - employer.organisation_id must match learner.organisation_id
 */
export async function validateLearnerOrganisationCentre(
    organisationId: number,
    centreId: number,
    employerId: number
): Promise<{ valid: boolean; error?: string }> {
    // Validate centre belongs to organisation
    const centreValid = await validateCentreOrganisation(centreId, organisationId);
    if (!centreValid) {
        return { valid: false, error: 'Centre does not belong to the specified organisation' };
    }

    // Validate employer belongs to organisation
    const employerValid = await validateEmployerOrganisation(employerId, organisationId);
    if (!employerValid) {
        return { valid: false, error: 'Employer does not belong to the specified organisation' };
    }

    return { valid: true };
}
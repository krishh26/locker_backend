/**
 * Multi-tenant scope helpers.
 *
 * Organisation resolution (no auto-selection):
 * - OrganisationAdmin / CentreAdmin / Trainer: organisation_id from token (UserOrganisation / UserCentre / UserCourse). Do not require organisation_id from frontend.
 * - MasterAdmin: two modes:
 *   1. Global mode: no X-Organisation-Id or organisation_id → no organisation filter (full access).
 *   2. Organisation mode: X-Organisation-Id header or organisation_id query provided → filter by that organisation. Validate org exists when needed.
 * If an operation requires organisation context for MasterAdmin and none is provided, return 400 (use getRequiredOrganisationId).
 *
 * Scope order: Layer 1 organisation → Layer 2 centre (if CentreAdmin) → Layer 3 trainer/learner (if Trainer).
 * One organisation per user is enforced at assignment time (validateOneOrganisationPerUser); schema still supports multiple for future use.
 */
import { SelectQueryBuilder } from 'typeorm';
import { UserRole } from './constants';
import { AppDataSource } from '../data-source';
import { AccountManager } from '../entity/AccountManager.entity';
import { AccountManagerOrganisation } from '../entity/AccountManagerOrganisation.entity';
import { UserOrganisation } from '../entity/UserOrganisation.entity';
import { Centre } from '../entity/Centre.entity';
import { Employer } from '../entity/Employer.entity';
import { UserCentre } from '../entity/UserCentre.entity';
import { UserCourse } from '../entity/UserCourse.entity';
import { Organisation } from '../entity/Organisation.entity';
import { In } from 'typeorm';

/**
 * Optional organisation context for MasterAdmin (e.g. from query or header).
 * When set, MasterAdmin is restricted to that organisation only.
 * Never auto-pick first organisation.
 */
export type ScopeContext = { organisationId?: number } | undefined;

/** Normalise role from user (single role or roles array). Exported for controllers/middleware. */
export function resolveUserRole(user: any): string | undefined {
    if (user?.role) return user.role;
    if (Array.isArray(user?.roles) && user.roles.length) return user.roles[0];
    return undefined;
}

/**
 * Get scope context from request (organisation_id for MasterAdmin).
 * Reads req.query.organisation_id or req.headers['x-organisation-id'].
 * Do not default to first organisation; return undefined if missing.
 */
export function getScopeContext(req: any): ScopeContext {
    if (!req) return undefined;
    const fromQuery = req.query?.organisation_id;
    const fromHeader = req.headers?.['x-organisation-id'];
    const raw = fromQuery ?? fromHeader;
    if (raw == null || raw === '') return undefined;
    const id = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
    if (isNaN(id)) return undefined;
    return { organisationId: id };
}

/**
 * Require organisation context for MasterAdmin when endpoint needs it.
 * Returns organisationId if present or MasterAdmin has context; otherwise returns null (caller should return 400).
 */
export function getRequiredOrganisationId(user: any, scopeContext: ScopeContext): number | null {
    const role = resolveUserRole(user);
    if (role !== UserRole.MasterAdmin) return null; // Non-MasterAdmin don't need this check
    if (scopeContext?.organisationId != null) return scopeContext.organisationId;
    return null;
}

/**
 * Get accessible organisation IDs for a user - fetches fresh from database.
 * Layer 1 — Organisation scope.
 * - MasterAdmin: null (full access) unless scopeContext.organisationId set, then [that id].
 * - OrganisationAdmin / CentreAdmin / AccountManager: as before.
 * - Trainer: org IDs from learners they are assigned to (user_course.trainer_id).
 * @param user - User object from request (req.user)
 * @param scopeContext - Optional { organisationId } for MasterAdmin (from getScopeContext(req))
 * @returns null if MasterAdmin with no context (all access), array of IDs otherwise
 */
export async function getAccessibleOrganisationIds(user: any, scopeContext?: ScopeContext): Promise<number[] | null> {
    const role = resolveUserRole(user);
    console.log(role)
    if (role === UserRole.MasterAdmin) {
        if (scopeContext?.organisationId != null) {
            const orgRepo = AppDataSource.getRepository(Organisation);
            const org = await orgRepo.findOne({ where: { id: scopeContext.organisationId }, select: ['id'] });
            if (!org) return []; // Invalid org: no access (validate organisation exists)
            return [scopeContext.organisationId];
        }
        return null; // Full system access
    }

    if (role === UserRole.Trainer) {
        const ucRepo = AppDataSource.getRepository(UserCourse);
        const rows = await ucRepo
            .createQueryBuilder('uc')
            .innerJoin('uc.learner_id', 'l')
            .where('uc.trainer_id = :userId', { userId: user.user_id })
            .select('DISTINCT l.organisation_id', 'organisation_id')
            .getRawMany<{ organisation_id: number }>();
        const ids = rows.map(r => r.organisation_id).filter((id): id is number => id != null);
        return [...new Set(ids)];
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
 * Get organisation IDs assigned to a user (from UserOrganisation).
 * Used for one-organisation-per-user business rule validation.
 * Schema supports multiple; currently we enforce at most one per user.
 */
export async function getUserOrganisationIds(userId: number): Promise<number[]> {
    const userOrganisationRepository = AppDataSource.getRepository(UserOrganisation);
    const rows = await userOrganisationRepository.find({
        where: { user_id: userId },
        select: ['organisation_id']
    });
    return rows.map(r => r.organisation_id);
}

/**
 * Validate one-organisation-per-user rule before assigning a user to an organisation.
 * Returns error message if user already has a different organisation; null if valid.
 * Same organisation is allowed (idempotent assign).
 */
export async function validateOneOrganisationPerUser(userId: number, organisationIdToAssign: number): Promise<string | null> {
    const existing = await getUserOrganisationIds(userId);
    if (existing.length === 0) return null;
    if (existing.includes(organisationIdToAssign)) return null; // same org, idempotent
    return "User can only belong to one organisation. They are already assigned to another organisation.";
}

/**
 * Get accessible centre IDs for a user.
 * Layer 2 — Centre scope.
 * - MasterAdmin: null (all) unless scopeContext.organisationId set, then centres in that org.
 * - CentreAdmin: only assigned centre(s) via UserCentre.
 * - Trainer: centre IDs from learners they are assigned to (user_course.trainer_id).
 * - OrganisationAdmin / AccountManager: all centres in accessible orgs.
 * @param user - User object from request (req.user)
 * @param scopeContext - Optional for MasterAdmin (from getScopeContext(req))
 */
export async function getAccessibleCentreIds(user: any, scopeContext?: ScopeContext): Promise<number[] | null> {
    const role = resolveUserRole(user);

    if (role === UserRole.MasterAdmin) {
        if (scopeContext?.organisationId == null) return null;
        const centreRepository = AppDataSource.getRepository(Centre);
        const centres = await centreRepository
            .createQueryBuilder('centre')
            .where('centre.deleted_at IS NULL')
            .andWhere('centre.organisation_id = :orgId', { orgId: scopeContext.organisationId })
            .select('centre.id')
            .getMany();
        return centres.map(c => c.id);
    }

    if (role === UserRole.Trainer) {
        const ucRepo = AppDataSource.getRepository(UserCourse);
        const rows = await ucRepo
            .createQueryBuilder('uc')
            .innerJoin('uc.learner_id', 'l')
            .where('uc.trainer_id = :userId', { userId: user.user_id })
            .select('DISTINCT l.centre_id', 'centre_id')
            .getRawMany<{ centre_id: number }>();
        const ids = rows.map(r => r.centre_id).filter((id): id is number => id != null);
        return [...new Set(ids)];
    }

    const centreRepository = AppDataSource.getRepository(Centre);
    const userCentreRepository = AppDataSource.getRepository(UserCentre);

    const userCentreRows = await userCentreRepository.find({
        where: { user_id: user.user_id }
    });

    if (userCentreRows.length > 0) {
        const centreIds = [...new Set(userCentreRows.map(uc => uc.centre_id))];
        return centreIds;
    }

    const orgIds = await getAccessibleOrganisationIds(user, scopeContext);
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
export async function getAccessibleUserIds(user: any, scopeContext?: ScopeContext): Promise<number[] | null> {
    const role = resolveUserRole(user);
    if (role === UserRole.MasterAdmin) {
        if (scopeContext?.organisationId != null) {
            const userOrgRepository = AppDataSource.getRepository(UserOrganisation);
            const rows = await userOrgRepository
                .createQueryBuilder('uo')
                .select('DISTINCT uo.user_id', 'user_id')
                .where('uo.organisation_id = :orgId', { orgId: scopeContext.organisationId })
                .getRawMany();
            return rows.map((r: { user_id: number }) => r.user_id);
        }
        return null;
    }

    if (role === UserRole.Trainer) {
        return [user.user_id];
    }
    if (role === UserRole.CentreAdmin) {
        return getAccessibleCentreAdminUserIds(user);
    }

    const orgIds = await getAccessibleOrganisationIds(user, scopeContext);
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
 * Add centre filter to query builder (Layer 2).
 * @param scopeContext - Optional for MasterAdmin (from getScopeContext(req))
 */
export async function addCentreFilter(
    qb: SelectQueryBuilder<any>,
    user: any,
    centreColumn: string = 'centre_id',
    scopeContext?: ScopeContext
): Promise<void> {
    const accessibleCentreIds = await getAccessibleCentreIds(user, scopeContext);

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
 * MasterAdmin with scopeContext: only true if organisationId matches context.
 */
export async function canAccessOrganisation(user: any, organisationId: number, scopeContext?: ScopeContext): Promise<boolean> {
    console.log(organisationId)
    const ids = await getAccessibleOrganisationIds(user, scopeContext);
    console.log("???",ids)
    if (ids === null) return true;
    console.log(ids.includes(organisationId))
    let tempid = Number(organisationId)
    return ids.includes(tempid);
}

/**
 * Check whether the user can access the given centre (for single-resource checks).
 */
export async function canAccessCentre(user: any, centreId: number, scopeContext?: ScopeContext): Promise<boolean> {
    const ids = await getAccessibleCentreIds(user, scopeContext);
    if (ids === null) return true;
    let tempid = Number(centreId)
    return ids.includes(tempid);
}

/**
 * Add organization filter to query builder (Layer 1).
 * @param scopeContext - Optional for MasterAdmin (from getScopeContext(req))
 */
export async function addOrganisationFilter(
    qb: SelectQueryBuilder<any>,
    user: any,
    organisationColumn: string = 'organisation_id',
    scopeContext?: ScopeContext
): Promise<void> {
    const accessibleIds = await getAccessibleOrganisationIds(user, scopeContext);

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
    userAlias: string = 'user',
    scopeContext?: ScopeContext
): Promise<void> {
    const role = resolveUserRole(user);

    if (role === UserRole.MasterAdmin && !scopeContext?.organisationId) {
        return;
    }

    if (role === UserRole.CentreAdmin) {
        const centreIds = await getAccessibleCentreIds(user, scopeContext);
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

    const accessibleIds = await getAccessibleOrganisationIds(user, scopeContext);
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
    /** Organisation context for MasterAdmin (from getScopeContext(req)). When set, MasterAdmin is restricted to that org. */
    scopeContext?: ScopeContext;
    /** For Trainer: column for trainer_id (e.g. 'session.trainer_id'). When set, Layer 3 trainer filter is applied. */
    trainerIdColumn?: string;
};

/**
 * Central scope helper — applies Layer 1 (organisation) and Layer 2 (centre) and optionally Layer 3 (trainer).
 * Use in every query builder. All three layers apply together; no OR-based visibility.
 *
 * - MasterAdmin: no filter unless scopeContext.organisationId set, then org (and centre in that org if applicable).
 * - OrganisationAdmin: org filter only (no centre restriction).
 * - CentreAdmin: org + centre (assigned centres only).
 * - AccountManager: org filter (assigned orgs).
 * - Trainer: org + centre (from their assigned learners) + optional trainerIdColumn = current user (Layer 3).
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
    const scopeContext = options?.scopeContext;
    const role = resolveUserRole(user);

    if (role === UserRole.MasterAdmin && !scopeContext?.organisationId) {
        return;
    }

    const orgIds = await getAccessibleOrganisationIds(user, scopeContext);
    if (orgIds === null) {
        if (role === UserRole.MasterAdmin) return;
        qb.andWhere('1 = 0');
        return;
    }
    if (orgIds.length === 0) {
        qb.andWhere('1 = 0');
        return;
    }
    qb.andWhere(`${orgCol} IN (:...orgIds)`, { orgIds });

    if (applyCentre) {
        const centreIds = await getAccessibleCentreIds(user, scopeContext);
        if (centreIds !== null && centreIds.length === 0) {
            qb.andWhere('1 = 0');
            return;
        }
        if (centreIds != null && centreIds.length > 0) {
            qb.andWhere(`${centreCol} IN (:...centreIds)`, { centreIds });
        }
    }

    if (role === UserRole.Trainer && options?.trainerIdColumn) {
        qb.andWhere(`${options.trainerIdColumn} = :trainerUserId`, { trainerUserId: user.user_id });
    }
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

export type LearnerScopeOptions = { scopeContext?: ScopeContext };

/**
 * Apply scope filter to Learner query builder. Layer 1 (org) + Layer 2 (centre) + Layer 3 (Trainer: only assigned learners).
 */
export async function applyLearnerScope(
    qb: SelectQueryBuilder<any>,
    user: any,
    learnerAlias: string = 'learner',
    options?: LearnerScopeOptions
): Promise<void> {
    const role = resolveUserRole(user);
    const scopeContext = options?.scopeContext;
    if (role === UserRole.MasterAdmin && !scopeContext?.organisationId) return;

    if (role === UserRole.OrganisationAdmin || role === UserRole.AccountManager || role === UserRole.CentreAdmin || role === UserRole.Trainer) {
        await applyScope(qb, user, learnerAlias, { scopeContext });
        if (role === UserRole.Trainer) {
            qb.andWhere(
                `${learnerAlias}.learner_id IN (SELECT uc.learner_id FROM user_course uc WHERE uc.trainer_id = :trainerUserId)`,
                { trainerUserId: user.user_id }
            );
        }
        return;
    }

    const orgIds = await getAccessibleOrganisationIds(user, scopeContext);
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
import { SelectQueryBuilder } from 'typeorm';
import { UserRole } from './constants';
import { AppDataSource } from '../data-source';
import { AccountManager } from '../entity/AccountManager.entity';
import { AccountManagerOrganisation } from '../entity/AccountManagerOrganisation.entity';
import { UserOrganisation } from '../entity/UserOrganisation.entity';

/**
 * Get accessible organisation IDs for a user - fetches fresh from database
 * @param user - User object from request (req.user)
 * @returns null if MasterAdmin (all access), array of IDs otherwise
 */
export async function getAccessibleOrganisationIds(user: any): Promise<number[] | null> {
    console.log(user.role, user.roles)
    if (user.role === UserRole.MasterAdmin) {
        return null; // All access
    }
    
    if (user.role === UserRole.AccountManager) {
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
    
    // For other roles, fetch from UserOrganisation
    const userOrganisationRepository = AppDataSource.getRepository(UserOrganisation);
    const userOrganisations = await userOrganisationRepository.find({
        where: { user_id: user.user_id }
    });
    console.log(userOrganisations.map(uo => uo.organisation_id), ">>>>", userOrganisations)
    return userOrganisations.map(uo => uo.organisation_id);
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
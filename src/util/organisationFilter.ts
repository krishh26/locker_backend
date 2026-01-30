import { SelectQueryBuilder } from 'typeorm';
import { UserRole } from './constants';

/**
 * Get accessible organisation IDs for a user
 * @param user - User object from request (req.user)
 * @returns null if MasterAdmin (all access), array of IDs otherwise
 */
export function getAccessibleOrganisationIds(user: any): number[] | null {
    if (user.role === UserRole.MasterAdmin) {
        return null; // All access
    }
    return user.assignedOrganisationIds || [];
}

/**
 * Add organization filter to query builder
 * @param qb - TypeORM QueryBuilder
 * @param user - User object from request
 * @param organisationColumn - Column name for organisation_id (default: 'organisation_id')
 */
export function addOrganisationFilter(
    qb: SelectQueryBuilder<any>,
    user: any,
    organisationColumn: string = 'organisation_id'
): void {
    const accessibleIds = getAccessibleOrganisationIds(user);
    
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
export function addUserOrganisationFilter(
    qb: SelectQueryBuilder<any>,
    user: any
): void {
    const accessibleIds = getAccessibleOrganisationIds(user);
    
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

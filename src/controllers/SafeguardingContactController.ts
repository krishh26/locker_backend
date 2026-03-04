import { Response } from 'express';
import { AppDataSource } from '../data-source';
import { CustomRequest } from '../util/Interface/expressInterface';
import { SafeguardingContact } from '../entity/SafeguardingContact.entity';
import { User } from '../entity/User.entity';
import {
    canAccessOrganisation,
    getAccessibleOrganisationIds,
    getAccessibleCentreIds,
    resolveUserRole,
    getScopeContext,
} from '../util/organisationFilter';
import { UserRole } from '../util/constants';

export class SafeguardingContactController {
    // Add new Safeguarding Contact
    public async upsertContact(req: CustomRequest, res: Response) {
        try {
            const { telNumber, mobileNumber, emailAddress, additionalInfo } = req.body as any;

            const scopeContext = getScopeContext(req);
            let organisationId: number | null =
                req.body?.organisation_id != null
                    ? Number(req.body.organisation_id)
                    : scopeContext?.organisationId ?? null;

            if (organisationId == null || isNaN(organisationId)) {
                return res.status(400).json({
                    message: 'organisation_id is required (body or query/header X-Organisation-Id)',
                    status: false,
                });
            }

            if (req.user && !(await canAccessOrganisation(req.user, organisationId, scopeContext))) {
                return res.status(403).json({
                    message: 'You do not have access to this organisation',
                    status: false,
                });
            }

            if (!emailAddress) {
                return res.status(400).json({
                    message: "Email address is required",
                    status: false
                });
            }

            const repo = AppDataSource.getRepository(SafeguardingContact);

            let existing = await repo.findOne({ where: { emailAddress, organisation_id: organisationId } });
            if (existing && req.user && resolveUserRole(req.user) !== UserRole.MasterAdmin) {
                const role = resolveUserRole(req.user);
                const checkQb = repo.createQueryBuilder('sc')
                    .leftJoin(User, 'u', 'u.user_id = CAST(sc.createdBy AS INT)')
                    .where('sc.id = :id', { id: existing.id });
                if (role === UserRole.CentreAdmin) {
                    const centreIds = await getAccessibleCentreIds(req.user, scopeContext);
                    if (centreIds === null || centreIds.length === 0) {
                        return res.status(403).json({ message: 'You do not have access to this contact', status: false });
                    }
                    checkQb.innerJoin('u.userCentres', 'uc').andWhere('uc.centre_id IN (:...centreIds)', { centreIds });
                } else {
                    const orgIds = await getAccessibleOrganisationIds(req.user, scopeContext);
                    if (orgIds === null || orgIds.length === 0) {
                        return res.status(403).json({ message: 'You do not have access to this contact', status: false });
                    }
                    checkQb.innerJoin('u.userOrganisations', 'uo').andWhere('uo.organisation_id IN (:...orgIds)', { orgIds });
                }
                const inScope = await checkQb.getOne();
                if (!inScope) {
                    return res.status(403).json({ message: 'You do not have access to this contact', status: false });
                }
            }

            if (existing) {
                // Update existing
                repo.merge(existing, {
                    organisation_id: organisationId,
                    telNumber: telNumber ?? existing.telNumber,
                    mobileNumber: mobileNumber ?? existing.mobileNumber,
                    additionalInfo: additionalInfo ?? existing.additionalInfo,
                    updatedBy: String(req.user.user_id),
                });

                const saved = await repo.save(existing);
                return res.status(200).json({
                    message: "Safeguarding Contact updated successfully",
                    status: true,
                    data: saved
                });
            } else {
                // Create new
                const entity = repo.create({
                    organisation_id: organisationId,
                    telNumber: telNumber || null,
                    mobileNumber: mobileNumber || null,
                    emailAddress,
                    additionalInfo: additionalInfo || null,
                    createdBy: String(req.user.user_id),
                    updatedBy: null,
                });

                const saved = await repo.save(entity);
                return res.status(201).json({
                    message: "Safeguarding Contact created successfully",
                    status: true,
                    data: saved
                });
            }
        } catch (error: any) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    // Update Safeguarding Contact
    public async updateContact(req: CustomRequest, res: Response) {
        try {
            const id = parseInt(req.params.id);
            const { telNumber, mobileNumber, emailAddress, additionalInfo } = req.body as any;
            const scopeContext = getScopeContext(req);
            const organisationId =
                scopeContext?.organisationId ??
                (req.query?.organisation_id != null ? Number(req.query.organisation_id) : NaN);

            if (organisationId == null || isNaN(organisationId)) {
                return res.status(400).json({
                    message: 'organisation_id is required (query or X-Organisation-Id header)',
                    status: false,
                });
            }

            const repo = AppDataSource.getRepository(SafeguardingContact);
            const qb = repo.createQueryBuilder('sc')
                .leftJoin(User, 'u', 'u.user_id = CAST(sc.createdBy AS INT)')
                .where('sc.id = :id', { id })
                .andWhere('sc.organisation_id = :organisationId', { organisationId });
            const existing = await qb.getOne();

            if (!existing) {
                return res.status(403).json({ 
                    message: 'Safeguarding Contact not found or you do not have access', 
                    status: false 
                });
            }

            repo.merge(existing, {
                telNumber: telNumber ?? existing.telNumber,
                mobileNumber: mobileNumber ?? existing.mobileNumber,
                emailAddress: emailAddress ?? existing.emailAddress,
                additionalInfo: additionalInfo ?? existing.additionalInfo,
                updatedBy: String(req.user.user_id)
            });

            const saved = await repo.save(existing);
            return res.status(200).json({ 
                message: 'Safeguarding Contact updated successfully', 
                status: true, 
                data: saved 
            });

        } catch (error: any) {
            return res.status(500).json({ 
                message: 'Internal Server Error', 
                status: false, 
                error: error.message 
            });
        }
    }

    // Get all Safeguarding Contacts
    public async getAllContacts(req: CustomRequest, res: Response) {
        try {
            const scopeContext = getScopeContext(req);
            const organisationId =
                scopeContext?.organisationId ??
                (req.query?.organisation_id != null ? Number(req.query.organisation_id) : NaN);

            if (organisationId == null || isNaN(organisationId)) {
                return res.status(400).json({
                    message: 'organisation_id is required (query or X-Organisation-Id header)',
                    status: false,
                });
            }

            const repo = AppDataSource.getRepository(SafeguardingContact);

            const qb = repo.createQueryBuilder('sc')
                .leftJoin(User, 'u', 'u.user_id = CAST(sc.createdBy AS INT)')
                .addSelect(['u.first_name', 'u.last_name'])
                .leftJoin(User, 'uu', 'uu.user_id = CAST(sc.updatedBy AS INT)')
                .addSelect(['uu.first_name AS updated_first_name', 'uu.last_name AS updated_last_name'])
                .where('sc.organisation_id = :organisationId', { organisationId });

            const contacts = await qb
                .orderBy('sc.createdAt', 'DESC')
                .getMany();

            return res.status(200).json({ 
                message: 'Safeguarding Contacts retrieved successfully', 
                status: true, 
                data: contacts 
            });

        } catch (error: any) {
            return res.status(500).json({ 
                message: 'Internal Server Error', 
                status: false, 
                error: error.message 
            });
        }
    }

    // Get Safeguarding Contact by ID
    public async getContactById(req: CustomRequest, res: Response) {
        try {
            const id = parseInt(req.params.id);
            const scopeContext = getScopeContext(req);
            const organisationId =
                scopeContext?.organisationId ??
                (req.query?.organisation_id != null ? Number(req.query.organisation_id) : NaN);

            if (organisationId == null || isNaN(organisationId)) {
                return res.status(400).json({
                    message: 'organisation_id is required (query or X-Organisation-Id header)',
                    status: false,
                });
            }
            const repo = AppDataSource.getRepository(SafeguardingContact);

            const qb = repo.createQueryBuilder('sc')
                .leftJoin(User, 'u', 'u.user_id = CAST(sc.createdBy AS INT)')
                .addSelect(['u.first_name', 'u.last_name'])
                .leftJoin(User, 'uu', 'uu.user_id = CAST(sc.updatedBy AS INT)')
                .addSelect(['uu.first_name AS updated_first_name', 'uu.last_name AS updated_last_name'])
                .where('sc.id = :id', { id })
                .andWhere('sc.organisation_id = :organisationId', { organisationId });

            const contact = await qb.getOne();

            if (!contact) {
                return res.status(404).json({ 
                    message: 'Safeguarding Contact not found', 
                    status: false 
                });
            }

            return res.status(200).json({ 
                message: 'Safeguarding Contact retrieved successfully', 
                status: true, 
                data: contact 
            });

        } catch (error: any) {
            return res.status(500).json({ 
                message: 'Internal Server Error', 
                status: false, 
                error: error.message 
            });
        }
    }

    // Toggle active status
    public async toggleActive(req: CustomRequest, res: Response) {
        try {
            const id = parseInt(req.params.id);
            const scopeContext = getScopeContext(req);
            const organisationId =
                scopeContext?.organisationId ??
                (req.query?.organisation_id != null ? Number(req.query.organisation_id) : NaN);

            if (organisationId == null || isNaN(organisationId)) {
                return res.status(400).json({
                    message: 'organisation_id is required (query or X-Organisation-Id header)',
                    status: false,
                });
            }
            const repo = AppDataSource.getRepository(SafeguardingContact);
            const qb = repo.createQueryBuilder('sc')
                .leftJoin(User, 'u', 'u.user_id = CAST(sc.createdBy AS INT)')
                .where('sc.id = :id', { id })
                .andWhere('sc.organisation_id = :organisationId', { organisationId });
            const contact = await qb.getOne();
            if (!contact) {
                return res.status(403).json({ 
                    message: 'Safeguarding Contact not found or you do not have access', 
                    status: false 
                });
            }

            contact.updatedBy = String(req.user.user_id);
            
            await repo.save(contact);
            
            return res.status(200).json({ 
                message: 'Safeguarding Contact status toggled successfully', 
                status: true, 
                data: { 
                    id: contact.id
                } 
            });

        } catch (error: any) {
            return res.status(500).json({ 
                message: 'Internal Server Error', 
                status: false, 
                error: error.message 
            });
        }
    }

    // Delete Safeguarding Contact (soft delete by setting isActive to false)
    public async deleteContact(req: CustomRequest, res: Response) {
        try {
            const id = parseInt(req.params.id);
            const scopeContext = getScopeContext(req);
            const organisationId =
                scopeContext?.organisationId ??
                (req.query?.organisation_id != null ? Number(req.query.organisation_id) : NaN);

            if (organisationId == null || isNaN(organisationId)) {
                return res.status(400).json({
                    message: 'organisation_id is required (query or X-Organisation-Id header)',
                    status: false,
                });
            }
            const repo = AppDataSource.getRepository(SafeguardingContact);
            
            const contact = await repo.findOne({ where: { id, organisation_id: organisationId } });
            if (!contact) {
                return res.status(404).json({ 
                    message: 'Safeguarding Contact not found', 
                    status: false 
                });
            }

            contact.updatedBy = String(req.user.user_id);
            
            await repo.save(contact);
            
            return res.status(200).json({ 
                message: 'Safeguarding Contact deleted successfully', 
                status: true 
            });

        } catch (error: any) {
            return res.status(500).json({ 
                message: 'Internal Server Error', 
                status: false, 
                error: error.message 
            });
        }
    }
}

export default SafeguardingContactController;

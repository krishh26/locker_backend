import { Response } from 'express';
import { AppDataSource } from '../data-source';
import { CustomRequest } from '../util/Interface/expressInterface';
import { SafeguardingContact } from '../entity/SafeguardingContact.entity';
import { User } from '../entity/User.entity';

export class SafeguardingContactController {
    // Add new Safeguarding Contact
    public async upsertContact(req: CustomRequest, res: Response) {
        try {
            const { telNumber, mobileNumber, emailAddress, additionalInfo } = req.body as any;

            if (!emailAddress) {
                return res.status(400).json({
                    message: "Email address is required",
                    status: false
                });
            }

            const repo = AppDataSource.getRepository(SafeguardingContact);

            // Check if record exists by email
            let existing = await repo.findOne({ where: { emailAddress } });

            if (existing) {
                // Update existing
                repo.merge(existing, {
                    telNumber: telNumber ?? existing.telNumber,
                    mobileNumber: mobileNumber ?? existing.mobileNumber,
                    additionalInfo: additionalInfo ?? existing.additionalInfo,
                    updatedBy: String(req.user.user_id)
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
                    telNumber: telNumber || null,
                    mobileNumber: mobileNumber || null,
                    emailAddress,
                    additionalInfo: additionalInfo || null,
                    createdBy: String(req.user.user_id),
                    updatedBy: null
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

            const repo = AppDataSource.getRepository(SafeguardingContact);
            const existing = await repo.findOne({ where: { id } });
            
            if (!existing) {
                return res.status(404).json({ 
                    message: 'Safeguarding Contact not found', 
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
            const repo = AppDataSource.getRepository(SafeguardingContact);

            const qb = repo.createQueryBuilder('sc')
                .leftJoin(User, 'u', 'u.user_id = CAST(sc.createdBy AS INT)')
                .addSelect(['u.first_name', 'u.last_name'])
                .leftJoin(User, 'uu', 'uu.user_id = CAST(sc.updatedBy AS INT)')
                .addSelect(['uu.first_name AS updated_first_name', 'uu.last_name AS updated_last_name']);

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
            const repo = AppDataSource.getRepository(SafeguardingContact);

            const contact = await repo.createQueryBuilder('sc')
                .leftJoin(User, 'u', 'u.user_id = CAST(sc.createdBy AS INT)')
                .addSelect(['u.first_name', 'u.last_name'])
                .leftJoin(User, 'uu', 'uu.user_id = CAST(sc.updatedBy AS INT)')
                .addSelect(['uu.first_name AS updated_first_name', 'uu.last_name AS updated_last_name'])
                .where('sc.id = :id', { id })
                .getOne();

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
            const repo = AppDataSource.getRepository(SafeguardingContact);
            
            const contact = await repo.findOne({ where: { id } });
            if (!contact) {
                return res.status(404).json({ 
                    message: 'Safeguarding Contact not found', 
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
            const repo = AppDataSource.getRepository(SafeguardingContact);
            
            const contact = await repo.findOne({ where: { id } });
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

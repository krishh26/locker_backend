import { Response } from "express";
import { AppDataSource } from "../data-source";
import { CustomRequest } from "../util/Interface/expressInterface";
import { FormTemplate } from "../entity/FormTemplate.entity";
import { getAccessibleOrganisationIds } from "../util/organisationFilter";

async function canAccessFormTemplate(user: CustomRequest['user'], template: FormTemplate): Promise<boolean> {
    if (!user) return false;
    const orgIds = await getAccessibleOrganisationIds(user);
    if (orgIds === null) return true;
    return template.organisation_id != null && orgIds.includes(template.organisation_id);
}

class FormTemplateController {

    public async CreateFormTemplate(req: CustomRequest, res: Response) {
        try {
            const formTemplateRepository = AppDataSource.getRepository(FormTemplate);
            const body = { ...req.body };
            if (body.organisation_id == null && req.user) {
                const accessibleIds = await getAccessibleOrganisationIds(req.user);
                if (accessibleIds != null && accessibleIds.length > 0) {
                    body.organisation_id = accessibleIds[0];
                }
            }
            const form = formTemplateRepository.create(body);
            const savedForm = await formTemplateRepository.save(form);
            res.status(200).json({
                message: "Form Template created successfully",
                status: true,
                data: savedForm,
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                error: error.message,
                status: false,
            });
        }
    }

    public async updateFormTemplate(req: CustomRequest, res: Response) {
        try {
            const id = parseInt(req.params.id);
            const { template_name, data } = req.body;

            const formTemplateRepository = AppDataSource.getRepository(FormTemplate);
            const form = await formTemplateRepository.findOne({ where: { id } });
            if (!form) {
                return res.status(404).json({
                    message: 'Form Template not found',
                    status: false,
                });
            }
            if (!(await canAccessFormTemplate(req.user, form))) {
                return res.status(403).json({
                    message: 'You do not have access to this form template',
                    status: false,
                });
            }
            form.template_name = template_name || form.template_name;
            form.data = data || form.data;

            const updatedForm = await formTemplateRepository.save(form);

            return res.status(200).json({
                message: 'Form Template updated successfully',
                status: true,
                data: updatedForm,
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    public async getFormTemplate(req: CustomRequest, res: Response) {
        try {
            const id = parseInt(req.params.id);

            const formTemplateRepository = AppDataSource.getRepository(FormTemplate);
            const form = await formTemplateRepository.createQueryBuilder('formtemplate')
                .where('formtemplate.id = :id', { id })
                .getOne();
            if (!form) {
                return res.status(404).json({
                    message: 'Form Template not found',
                    status: false,
                });
            }
            if (!(await canAccessFormTemplate(req.user, form))) {
                return res.status(403).json({
                    message: 'You do not have access to this form template',
                    status: false,
                });
            }
            return res.status(200).json({
                message: 'Form Template retrieved successfully',
                status: true,
                data: form,
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    public async getFormTemplates(req: CustomRequest, res: Response) {
        try {
            const formTemplateRepository = AppDataSource.getRepository(FormTemplate);
            const qb = formTemplateRepository.createQueryBuilder('formtemplate');

            if (req.user) {
                const accessibleIds = await getAccessibleOrganisationIds(req.user);
                if (accessibleIds !== null) {
                    if (accessibleIds.length === 0) {
                        return res.status(200).json({
                            message: 'Form Template retrieved successfully',
                            status: true,
                            data: []
                        });
                    }
                    qb.andWhere('formtemplate.organisation_id IN (:...orgIds)', { orgIds: accessibleIds });
                }
            }

            const [forms, count] = await qb
                .orderBy('formtemplate.created_at', 'DESC')
                .getManyAndCount();

            return res.status(200).json({
                message: 'Form Template retrieved successfully',
                status: true,
                data: forms
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    public async deleteFormTemplate(req: CustomRequest, res: Response) {
        try {
            const id = parseInt(req.params.id);
            const formTemplateRepository = AppDataSource.getRepository(FormTemplate);
            const form = await formTemplateRepository.findOne({ where: { id } });
            if (!form) {
                return res.status(404).json({
                    message: 'Form Template not found',
                    status: false,
                });
            }
            if (!(await canAccessFormTemplate(req.user, form))) {
                return res.status(403).json({
                    message: 'You do not have access to this form template',
                    status: false,
                });
            }
            const deleteResult = await formTemplateRepository.delete(id);

            if (deleteResult.affected === 0) {
                return res.status(404).json({
                    message: 'Form Template not found',
                    status: false,
                });
            }

            return res.status(200).json({
                message: 'Form Template deleted successfully',
                status: true,
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

}

export default FormTemplateController;
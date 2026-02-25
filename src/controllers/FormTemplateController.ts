import { Response } from "express";
import { AppDataSource } from "../data-source";
import { CustomRequest } from "../util/Interface/expressInterface";
import { Form } from "../entity/Form.entity";
import { UserRole } from "../util/constants";
import { User } from "../entity/User.entity";
import { UserForm } from "../entity/UserForm.entity";
import { FormTemplate } from "../entity/FormTemplate.entity";
import { applyScope, getScopeContext, getAccessibleOrganisationIds, canAccessOrganisation, resolveUserRole } from "../util/organisationFilter";

class FormTemplateController {

    public async CreateFormTemplate(req: CustomRequest, res: Response) {
        try {
            const scopeContext = getScopeContext(req);
            const role = resolveUserRole(req.user);
            let organisationId: number | null = req.body.organisation_id != null ? Number(req.body.organisation_id) : null;

            if (organisationId == null || isNaN(organisationId)) {
                const accessibleIds = req.user ? await getAccessibleOrganisationIds(req.user, scopeContext) : null;
                if (role === UserRole.MasterAdmin) {
                    organisationId = scopeContext?.organisationId ?? null;
                    if (organisationId == null) {
                        return res.status(400).json({
                            message: "organisation_id is required (or set X-Organisation-Id for MasterAdmin)",
                            status: false,
                        });
                    }
                } else if (accessibleIds != null && accessibleIds.length > 0) {
                    organisationId = accessibleIds[0];
                }
            }

            if (organisationId == null) {
                return res.status(400).json({
                    message: "organisation_id is required",
                    status: false,
                });
            }

            if (req.user && !(await canAccessOrganisation(req.user, organisationId, scopeContext))) {
                return res.status(403).json({
                    message: "You do not have access to this organisation",
                    status: false,
                });
            }

            const formTemplateRepository = AppDataSource.getRepository(FormTemplate);
            const form = formTemplateRepository.create({
                ...req.body,
                organisation_id: organisationId,
            });
            const savedForm = await formTemplateRepository.save(form);
            res.status(200).json({
                message: "Form Template created successfully",
                status: true,
                data: savedForm,
            });

        } catch (error: any) {
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
            const qb = formTemplateRepository.createQueryBuilder("formtemplate")
                .where("formtemplate.id = :id", { id });
            if (req.user) {
                await applyScope(qb, req.user, "formtemplate", { organisationOnly: true, scopeContext: getScopeContext(req) });
            }
            const form = await qb.getOne();

            if (!form) {
                return res.status(404).json({
                    message: 'Form Template not found',
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
        } catch (error: any) {
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
            const qb = formTemplateRepository.createQueryBuilder("formtemplate")
                .where("formtemplate.id = :id", { id });
            if (req.user) {
                await applyScope(qb, req.user, "formtemplate", { organisationOnly: true, scopeContext: getScopeContext(req) });
            }
            const form = await qb.getOne();

            if (!form) {
                return res.status(404).json({
                    message: 'Form Template not found',
                    status: false,
                });
            }

            return res.status(200).json({
                message: 'Form Template retrieved successfully',
                status: true,
                data: form,
            });
        } catch (error: any) {
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
            const qb = formTemplateRepository.createQueryBuilder("formtemplate");
            if (req.user) {
                await applyScope(qb, req.user, "formtemplate", { organisationOnly: true, scopeContext: getScopeContext(req) });
            }
            const [forms, count] = await qb
                .orderBy("formtemplate.created_at", "DESC")
                .getManyAndCount();

            return res.status(200).json({
                message: 'Form Template retrieved successfully',
                status: true,
                data: forms
            });
        } catch (error: any) {
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
            const qb = formTemplateRepository.createQueryBuilder("formtemplate")
                .where("formtemplate.id = :id", { id });
            if (req.user) {
                await applyScope(qb, req.user, "formtemplate", { organisationOnly: true, scopeContext: getScopeContext(req) });
            }
            const form = await qb.getOne();
            if (!form) {
                return res.status(404).json({
                    message: 'Form Template not found',
                    status: false,
                });
            }
            await formTemplateRepository.remove(form);

            return res.status(200).json({
                message: 'Form Template deleted successfully',
                status: true,
            });
        } catch (error: any) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

}

export default FormTemplateController;
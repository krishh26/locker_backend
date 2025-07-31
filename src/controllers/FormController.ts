import { Response } from "express";
import { AppDataSource } from "../data-source";
import { CustomRequest } from "../util/Interface/expressInterface";
import { Form } from "../entity/Form.entity";
import { UserRole } from "../util/constants";
import { User } from "../entity/User.entity";
import { UserForm } from "../entity/UserForm.entity";
import { SendEmailTemplet } from "../util/nodemailer";
import { uploadToS3, uploadMultipleFilesToS3 } from "../util/aws";

class FormController {

    public async CreateForm(req: CustomRequest, res: Response) {
        try {
            const { form_name, description, form_data, type } = req.body;

            const formRepository = AppDataSource.getRepository(Form);
            let data = {
                form_name,
                description,
                form_data,
                type
            }

            const form = formRepository.create(data)

            const savedForm = await formRepository.save(form);
            res.status(200).json({
                message: "Form created successfully",
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

    public async updateForm(req: CustomRequest, res: Response) {
        try {
            const id = parseInt(req.params.id);
            const { form_name, description, form_data, type } = req.body;
            if (!form_name && !description && !form_data && !type) {
                return res.status(400).json({
                    message: 'At least one field required',
                    status: false,
                });
            }

            const formRepository = AppDataSource.getRepository(Form);

            const form = await formRepository.findOne({ where: { id } });

            if (!form) {
                return res.status(404).json({
                    message: 'Form not found',
                    status: false,
                });
            }

            form.form_name = form_name || form.form_name;
            form.form_data = form_data || form.form_data;
            form.description = description ?? form.description;
            form.type = type || form.type;

            const updatedForm = await formRepository.save(form);

            return res.status(200).json({
                message: 'Form updated successfully',
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

    public async getForm(req: CustomRequest, res: Response) {
        try {
            const id = parseInt(req.params.id);

            const formRepository = AppDataSource.getRepository(Form);

            const form = await formRepository.createQueryBuilder('form')
                .where('form.id = :id', { id })
                .getOne();


            if (!form) {
                return res.status(404).json({
                    message: 'Form not found',
                    status: false,
                });
            }

            return res.status(200).json({
                message: 'Form retrieved successfully',
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

    public async getForms(req: CustomRequest, res: Response) {
        try {
            const formRepository = AppDataSource.getRepository(Form);
            const qb = formRepository.createQueryBuilder('form')

            if (req.query.keyword) {
                qb.andWhere("(form.form_name ILIKE :keyword)", { keyword: `%${req.query.keyword}%` });
            }
            if (req.query.user_id) {
                qb.innerJoin('form.users', 'user', 'user.user_id = :user_id', { user_id: req.query.user_id })
            }

            const [forms, count] = await qb
                .skip(Number(req.pagination.skip))
                .take(Number(req.pagination.limit))
                .orderBy(`form.created_at`, "DESC")
                .getManyAndCount();

            return res.status(200).json({
                message: 'Form retrieved successfully',
                status: true,
                data: forms,
                ...(req.query.meta === "true" && {
                    meta_data: {
                        page: req.pagination.page,
                        items: count,
                        page_size: req.pagination.limit,
                        pages: Math.ceil(count / req.pagination.limit)
                    }
                })
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    public async deleteForm(req: CustomRequest, res: Response) {
        try {
            const id = parseInt(req.params.id);
            const formRepository = AppDataSource.getRepository(Form);

            const deleteResult = await formRepository.delete(id);

            if (deleteResult.affected === 0) {
                return res.status(404).json({
                    message: 'Form not found',
                    status: false,
                });
            }

            return res.status(200).json({
                message: 'Form deleted successfully',
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

    public async addUsersToForm(req: CustomRequest, res: Response) {
        const formRepository = AppDataSource.getRepository(Form);
        const userRepository = AppDataSource.getRepository(User);
        const form_id = parseInt(req.params.id);
        const { user_ids, assign } = req.body;

        try {
            const form = await formRepository
                .createQueryBuilder('form')
                .leftJoinAndSelect('form.users', 'user')
                .select([
                    'form.id',
                    'form.form_name',
                    'form.form_data',
                    'form.description',
                    'form.created_at',
                    'form.type',
                    'form.updated_at',
                    'user.user_id',
                    'user.user_name',
                    'user.email'
                ])
                .where('form.id = :form_id', { form_id })
                .getOne();

            if (!form) {
                return res.status(404).json({
                    message: 'Form not found',
                    status: false
                });
            }
            let usersToAdd
            if (user_ids) {
                usersToAdd = await userRepository.findByIds(user_ids);

                if (!usersToAdd.length) {
                    return res.status(404).json({
                        message: 'Users not found',
                        status: false,
                    });
                }

                const usersToAddFiltered = usersToAdd.filter(user => !form.users.some(existingUser => existingUser.user_id === user.user_id));

                form.users = [...(form?.users || []), ...usersToAddFiltered];
            } else if (assign) {

                const roleMap = {
                    "All": null,
                    "All Learner": UserRole.Learner,
                    "All Trainer": UserRole.Trainer,
                    "All Employer": UserRole.Employer,
                    "All IQA": UserRole.IQA,
                    "All LIQA": UserRole.LIQA,
                    "All EQA": UserRole.EQA
                };

                if (assign in roleMap) {
                    if (assign === "All") {
                        usersToAdd = await userRepository
                            .createQueryBuilder("user")
                            .select(["user.user_id", "user.roles"])
                            .where("NOT :role = ANY(user.roles)", { role: UserRole.Admin })
                            .getMany();
                    } else {
                        usersToAdd = await userRepository
                            .createQueryBuilder("user")
                            .select(["user.user_id", "user.roles"])
                            .where(":role = ANY(user.roles)", { role: roleMap[assign] })
                            .getMany();
                    }
                }
            }
            const usersToAddFiltered = usersToAdd.filter(user => !form.users.some(existingUser => existingUser.user_id === user.user_id));

            form.users = [...(form?.users || []), ...usersToAddFiltered];
            await formRepository.save(form);

            return res.status(200).json({
                message: 'Users added to form successfully',
                status: true,
                form
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    public async createUserFormData(req: CustomRequest, res: Response) {
        try {
            const userFormRepository = AppDataSource.getRepository(UserForm);
            const { form_id, form_data, user_id } = req.body;

            if (!form_id || !form_data) {
                return res.status(400).json({
                    message: 'Form ID and form data are required',
                    status: false,
                });
            }

            let parsedFormData: any;
            try {
                parsedFormData = typeof form_data === 'string' ? JSON.parse(form_data) : form_data;
            } catch (error) {
                return res.status(400).json({
                    message: 'Invalid form data format',
                    status: false,
                });
            }

            // Handle file uploads dynamically
            let formFiles: any[] = [];
            if (req.files) {
                // Handle both array and object formats from multer
                if (Array.isArray(req.files)) {
                    // Single field with multiple files
                    if (req.files.length > 0) {
                        try {
                            const uploadedFiles = await uploadMultipleFilesToS3(req.files, "UserFormFiles");

                            const filesData = uploadedFiles.map((file, index) => ({
                                file_name: req.files[index].originalname,
                                file_size: req.files[index].size,
                                file_url: file.url,
                                s3_key: file.key,
                                uploaded_at: new Date()
                            }));

                            formFiles.push({
                                field_name: 'files', // default field name
                                files: filesData
                            });
                        } catch (uploadError) {
                            console.error('Error uploading files:', uploadError);
                            return res.status(500).json({
                                message: 'Failed to upload files',
                                status: false,
                                error: uploadError.message
                            });
                        }
                    }
                } else if (typeof req.files === 'object') {
                    // Multiple fields with files
                    const filesObject = req.files as { [fieldname: string]: any[] };

                    for (const [fieldName, fileArray] of Object.entries(filesObject)) {
                        if (fileArray && fileArray.length > 0) {
                            try {
                                const uploadedFiles = await uploadMultipleFilesToS3(fileArray, "UserFormFiles");

                                const filesData = uploadedFiles.map((file, index) => ({
                                    file_name: fileArray[index].originalname,
                                    file_size: fileArray[index].size,
                                    file_url: file.url,
                                    s3_key: file.key,
                                    uploaded_at: new Date()
                                }));

                                formFiles.push({
                                    field_name: fieldName,
                                    files: filesData
                                });
                            } catch (uploadError) {
                                console.error(`Error uploading files for field ${fieldName}:`, uploadError);
                                return res.status(500).json({
                                    message: `Failed to upload files for field ${fieldName}`,
                                    status: false,
                                    error: uploadError.message
                                });
                            }
                        }
                    }
                }
            }

            // Find existing form or create new one
            let userForm = await userFormRepository.findOne({
                where: {
                    user: { user_id: user_id || req.user.user_id },
                    form: { id: form_id }
                }
            });

            if (userForm) {
                // Update existing form
                userForm.form_data = parsedFormData;
                userForm.form_files = formFiles.length > 0 ? formFiles : userForm.form_files;
            } else {
                // Create new form
                userForm = userFormRepository.create({
                    user: { user_id: user_id || req.user.user_id },
                    form: { id: form_id },
                    form_data: parsedFormData,
                    form_files: formFiles.length > 0 ? formFiles : null
                });
            }

            const savedForm = await userFormRepository.save(userForm);

            // Fetch complete form with relations for response
            const completeForm = await userFormRepository.findOne({
                where: { id: savedForm.id },
                relations: ['user', 'form']
            });

            return res.status(200).json({
                message: "User's form saved successfully",
                status: true,
                data: {
                    id: completeForm.id,
                    form_data: completeForm.form_data,
                    form_files: completeForm.form_files,
                    total_files: formFiles.reduce((total, field) => total + field.files.length, 0),
                    file_fields: formFiles.map(field => ({
                        field_name: field.field_name,
                        file_count: field.files.length
                    })),
                    created_at: completeForm.created_at,
                    updated_at: completeForm.updated_at
                }
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    public async getUserFormData(req: CustomRequest, res: Response) {
        try {
            const userFormRepository = AppDataSource.getRepository(UserForm);
            const id = req.params.id as any;
            const user_id = req.query.user_id as any;
            let userForm = await userFormRepository.findOne({ where: { user: { user_id }, form: { id } }, relations: ['form'] });

            if (!userForm) {
                return res.status(404).json({
                    message: 'User form not found',
                    status: false,
                });
            }

            return res.status(200).json({
                message: 'User form fetch successfully',
                status: true,
                data: userForm
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    public async getUserForms(req: CustomRequest, res: Response) {
        try {
            const userFormRepository = AppDataSource.getRepository(UserForm);
            const qb = userFormRepository.createQueryBuilder('user_form')
                .innerJoinAndSelect('user_form.user', 'user')
                .innerJoinAndSelect('user_form.form', 'form')
                .select([
                    'user_form.id',
                    'user_form.form_data',
                    'user_form.created_at',
                    'user_form.updated_at',
                    'user.user_name',
                    'user.email',
                    'form.id',
                    'form.form_name',
                    'form.description',
                    'form.form_data',
                    'form.type',
                    'form.created_at',
                    'form.updated_at',
                    'user_form.form_files'
                ]);

            if (req.query.keyword) {
                qb.andWhere("(form.form_name ILIKE :keyword OR user.user_name ILIKE :keyword)", { keyword: `%${req.query.keyword}%` });
            }

            const [forms, count] = await qb
                .skip(Number(req.pagination.skip))
                .take(Number(req.pagination.limit))
                .orderBy(`user_form.created_at`, 'DESC')
                .getManyAndCount();

            return res.status(200).json({
                message: 'User Form retrieved successfully',
                status: true,
                data: forms,
                ...(req.query.meta === "true" && {
                    meta_data: {
                        page: req.pagination.page,
                        items: count,
                        page_size: req.pagination.limit,
                        pages: Math.ceil(count / req.pagination.limit)
                    }
                })
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    public async sendFormAssignmentEmail(req: CustomRequest, res: Response) {
        try {
            const { form_id, user_ids, assign } = req.body;

            if (!form_id) {
                return res.status(400).json({
                    message: 'Form ID is required',
                    status: false,
                });
            }

            const formRepository = AppDataSource.getRepository(Form);
            const userRepository = AppDataSource.getRepository(User);

            // Get form details
            const form = await formRepository.findOne({
                where: { id: form_id },
                relations: ['users']
            });

            if (!form) {
                return res.status(404).json({
                    message: 'Form not found',
                    status: false
                });
            }

            // Handle PDF upload if provided
            let pdfAttachment = null;
            if (req.file) {
                const uploadedFile = await uploadToS3(req.file, "FormPDF");
                pdfAttachment = {
                    filename: req.file.originalname,
                    path: uploadedFile.url,
                    contentType: 'application/pdf'
                };
            }

            // which users to send emails to
            let targetUsers: User[] = [];

            if (user_ids && Array.isArray(user_ids)) {
                // Send to specific users
                targetUsers = await userRepository
                    .createQueryBuilder("user")
                    .where("user.user_id IN (:...user_ids)", { user_ids })
                    .getMany();
            } else if (assign) {
                // Send to users by role
                const roleMap = {
                    "All": null,
                    "All Learner": UserRole.Learner,
                    "All Trainer": UserRole.Trainer,
                    "All Employer": UserRole.Employer,
                    "All IQA": UserRole.IQA,
                    "All LIQA": UserRole.LIQA,
                    "All EQA": UserRole.EQA
                };

                if (assign in roleMap) {
                    if (assign === "All") {
                        targetUsers = await userRepository
                            .createQueryBuilder("user")
                            .where("NOT :role = ANY(user.roles)", { role: UserRole.Admin })
                            .getMany();
                    } else {
                        targetUsers = await userRepository
                            .createQueryBuilder("user")
                            .where(":role = ANY(user.roles)", { role: roleMap[assign] })
                            .getMany();
                    }
                }
            } else {
                console.log("nothing")
                //targetUsers = form.users;
            }

            if (!targetUsers.length) {
                return res.status(400).json({
                    message: 'No users found to send emails to',
                    status: false
                });
            }

            // Prepare email content
            const subject = `New Form Assignment: ${form.form_name}`;
            const defaultMessage = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Form Assignment Notification</h2>
                    <p>You have been assigned a new form to complete:</p>
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <h3 style="margin: 0; color: #2c3e50;">${form.form_name}</h3>
                        ${form.description ? `<p style="margin: 10px 0 0 0; color: #666;">${form.description}</p>` : ''}
                    </div>
                    <p>Please log in to the system to access and complete the form.</p>
                    <p style="margin-top: 30px;">
                        <a href="${process.env.FRONTEND}" style="background-color: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Access Form</a>
                    </p>
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                    <p style="font-size: 12px; color: #666;">
                        This is an automated message from the Locker system. Please do not reply to this email.
                    </p>
                </div>
            `;

            // Send emails to all target users
            const emailPromises = targetUsers.map(async (user) => {
                try {
                    const attachments = pdfAttachment ? [pdfAttachment] : undefined;
                    await SendEmailTemplet(user.email, subject, null, defaultMessage, attachments);
                    return { user_id: user.user_id, email: user.email, status: 'sent' };
                } catch (error) {
                    console.error(`Failed to send email to ${user.email}:`, error);
                    return { user_id: user.user_id, email: user.email, status: 'failed', error: error.message };
                }
            });

            const emailResults = await Promise.all(emailPromises);
            const successCount = emailResults.filter(result => result.status === 'sent').length;
            const failureCount = emailResults.filter(result => result.status === 'failed').length;

            return res.status(200).json({
                message: `Form assignment emails processed. ${successCount} sent successfully, ${failureCount} failed.`,
                status: true,
                data: {
                    form_id,
                    form_name: form.form_name,
                    total_recipients: targetUsers.length,
                    successful_sends: successCount,
                    failed_sends: failureCount,
                    email_results: emailResults,
                    pdf_attached: !!pdfAttachment
                }
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

export default FormController;
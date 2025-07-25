import { Response } from 'express';
import { CustomRequest } from '../util/Interface/expressInterface';
import { AppDataSource } from '../data-source';
import {
    LearnerPlanDocument,
    LearnerPlanDocumentSignature,
    DocumentWho,
    DocumentFileType,
    DocumentUploadType,
    SignatureRole
} from '../entity/LearnerPlanDocument.entity';
import { LearnerPlan } from '../entity/LearnerPlan.entity';
import { Form } from '../entity/Form.entity';
import { User } from '../entity/User.entity';
import { uploadMultipleFilesToS3 } from '../util/aws';

export class LearnerPlanDocumentController {

    public async createDocument(req: CustomRequest, res: Response) {
        try {
            const {
                learner_plan_id,
                name,
                description,
                who,
                file_type,
                upload_type,
                form_id,
                signature_roles // Array of required signature roles
            } = req.body;

            // Validate required fields
            if (!learner_plan_id || !name || !who || !file_type || !upload_type) {
                return res.status(400).json({
                    message: 'Learner plan ID, name, who, file_type, and upload_type are required',
                    status: false,
                });
            }

            const documentRepository = AppDataSource.getRepository(LearnerPlanDocument);
            const learnerPlanRepository = AppDataSource.getRepository(LearnerPlan);
            const formRepository = AppDataSource.getRepository(Form);
            const signatureRepository = AppDataSource.getRepository(LearnerPlanDocumentSignature);

            // Verify learner plan exists
            const learnerPlan = await learnerPlanRepository.findOne({ 
                where: { learner_plan_id } 
            });
            if (!learnerPlan) {
                return res.status(404).json({
                    message: 'Learner plan not found',
                    status: false,
                });
            }

            let documentData: any = {
                learner_plan: learnerPlan,
                name,
                description: description || '',
                who: who as DocumentWho,
                file_type: file_type as DocumentFileType,
                upload_type: upload_type as DocumentUploadType,
                created_by: req.user.user_id
            };

            // Handle file uploads
            if (upload_type === DocumentUploadType.FileUpload) {
                if (!req.files || (req.files as any[]).length === 0) {
                    return res.status(400).json({
                        message: "Files are required for file upload type",
                        status: false
                    });
                }

                const uploadedFiles = await uploadMultipleFilesToS3(req.files, "LearnerPlanDocument");
                const files = req.files as any[];
                
                const filesData = uploadedFiles.map((file, index) => ({
                    file_name: files[index].originalname,
                    file_size: files[index].size,
                    file_url: file.url,
                    s3_key: file.key,
                    uploaded_at: new Date()
                }));

                documentData.uploaded_files = filesData;

            } else if (upload_type === DocumentUploadType.FormSelection) {
                if (!form_id) {
                    return res.status(400).json({
                        message: "Form ID is required for form selection type",
                        status: false
                    });
                }

                const form = await formRepository.findOne({ where: { id: form_id } });
                if (!form) {
                    return res.status(404).json({
                        message: 'Form not found',
                        status: false,
                    });
                }

                documentData.selected_form = form;
            }

            // Create document
            const document = documentRepository.create(documentData);
            const savedDocument = await documentRepository.save(document);

            // Type assertion to ensure savedDocument is treated as single entity
            const singleDocument = savedDocument as unknown as LearnerPlanDocument;

            // Create signature requirements
            if (signature_roles && Array.isArray(signature_roles)) {
                const signatures = signature_roles.map((role: string) =>
                    signatureRepository.create({
                        document: singleDocument,
                        role: role as SignatureRole,
                        is_required: true,
                        is_signed: false,
                        is_requested: false
                    })
                );

                await signatureRepository.save(signatures);
            }

            // Fetch complete document with relations
            const completeDocument = await documentRepository.findOne({
                where: { document_id: singleDocument.document_id },
                relations: ['learner_plan', 'selected_form', 'created_by', 'signatures']
            });

            return res.status(200).json({
                message: 'Document created successfully',
                status: true,
                data: completeDocument,
            });

        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    public async getDocumentsByLearnerPlan(req: CustomRequest, res: Response) {
        try {
            const { learner_plan_id } = req.params;

            if (!learner_plan_id) {
                return res.status(400).json({
                    message: 'Learner plan ID is required',
                    status: false,
                });
            }

            const documentRepository = AppDataSource.getRepository(LearnerPlanDocument);

            const documents = await documentRepository.find({
                where: { learner_plan: { learner_plan_id: parseInt(learner_plan_id) } },
                relations: ['learner_plan', 'selected_form', 'created_by', 'signatures', 'signatures.signed_by', 'signatures.requested_by'],
                order: { created_at: 'DESC' }
            });

            return res.status(200).json({
                message: 'Documents fetched successfully',
                status: true,
                data: documents,
            });

        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    public async getDocumentOptions(req: CustomRequest, res: Response) {
        try {
            const formRepository = AppDataSource.getRepository(Form);

            // Get all forms for selection
            const forms = await formRepository.find({
                select: ['id', 'form_name', 'description', 'type']
            });

            const options = {
                who_options: Object.values(DocumentWho),
                file_types: Object.values(DocumentFileType),
                upload_types: Object.values(DocumentUploadType),
                signature_roles: Object.values(SignatureRole),
                available_forms: forms
            };

            return res.status(200).json({
                message: 'Document options fetched successfully',
                status: true,
                data: options
            });

        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    public async updateSignature(req: CustomRequest, res: Response) {
        try {
            const { signature_id } = req.params;
            const { is_signed, is_requested } = req.body;

            if (!signature_id) {
                return res.status(400).json({
                    message: 'Signature ID is required',
                    status: false,
                });
            }

            const signatureRepository = AppDataSource.getRepository(LearnerPlanDocumentSignature);

            const signature = await signatureRepository.findOne({
                where: { signature_id: parseInt(signature_id) },
                relations: ['document', 'signed_by', 'requested_by']
            });

            if (!signature) {
                return res.status(404).json({
                    message: 'Signature not found',
                    status: false,
                });
            }

            // Update signature checkboxes
            if (is_signed !== undefined) {
                signature.is_signed = is_signed;
                if (is_signed) {
                    signature.signed_by = { user_id: req.user.user_id } as User;
                    signature.signed_date = new Date();
                } else {
                    signature.signed_by = null;
                    signature.signed_date = null;
                }
            }

            if (is_requested !== undefined) {
                signature.is_requested = is_requested;
                if (is_requested) {
                    signature.requested_by = { user_id: req.user.user_id } as User;
                    signature.requested_date = new Date();
                } else {
                    signature.requested_by = null;
                    signature.requested_date = null;
                }
            }

            const updatedSignature = await signatureRepository.save(signature);

            // Fetch updated signature with relations
            const completeSignature = await signatureRepository.findOne({
                where: { signature_id: updatedSignature.signature_id },
                relations: ['document', 'signed_by', 'requested_by']
            });

            return res.status(200).json({
                message: 'Signature updated successfully',
                status: true,
                data: completeSignature,
            });

        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    public async deleteDocument(req: CustomRequest, res: Response) {
        try {
            const { document_id } = req.params;

            if (!document_id) {
                return res.status(400).json({
                    message: 'Document ID is required',
                    status: false,
                });
            }

            const documentRepository = AppDataSource.getRepository(LearnerPlanDocument);

            const document = await documentRepository.findOne({
                where: { document_id: parseInt(document_id) }
            });

            if (!document) {
                return res.status(404).json({
                    message: 'Document not found',
                    status: false,
                });
            }

            await documentRepository.remove(document);

            return res.status(200).json({
                message: 'Document deleted successfully',
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

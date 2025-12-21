import { Response } from "express";
import { AppDataSource } from "../data-source";
import { CustomRequest } from "../util/Interface/expressInterface";
import { Assignment } from "../entity/Assignment.entity";
import { deleteFromS3, uploadToS3 } from "../util/aws";
import { UserCourse } from "../entity/UserCourse.entity";
import { UserRole } from "../util/constants";
import { AssignmentSignature } from "../entity/AssignmentSignature.entity";
import { Learner } from "../entity/Learner.entity";
import { User } from "../entity/User.entity";

class AssignmentController {

    /**
     * Check if user is authorized to access an assignment
     * Users can access assignments if:
     * 1. They own the assignment (created it)
     * 2. They are Admin
     * 3. They are involved in the course (trainer, IQA, LIQA, EQA, employer) for that assignment
     */
    private static async isUserAuthorizedForAssignment(userId: number, userRoles: string[], assignment: Assignment): Promise<boolean> {
        try {
            // Admin can access all assignments
            if (userRoles.includes(UserRole.Admin)) {
                return true;
            }

            if (assignment.user.user_id === userId) {
                return true;
            }

            const userCourseRepository = AppDataSource.getRepository(UserCourse);

            //const courseId = assignment.course_id.course_id;

            const userCourseInvolvement = await userCourseRepository.createQueryBuilder('user_course')
                .leftJoin('user_course.learner_id', 'learner')
                .leftJoin('learner.user_id', 'learner_user')
                .leftJoin('user_course.trainer_id', 'trainer')
                .leftJoin('user_course.IQA_id', 'IQA')
                .leftJoin('user_course.LIQA_id', 'LIQA')
                .leftJoin('user_course.EQA_id', 'EQA')
                .leftJoin('user_course.employer_id', 'employer')
                .where('(trainer.user_id = :userId OR IQA.user_id = :userId OR LIQA.user_id = :userId OR EQA.user_id = :userId OR employer.user_id = :userId)', { userId })
                .getOne();

            return !!userCourseInvolvement;
        } catch (error) {
            console.error('Error checking user authorization:', error);
            return false;
        }
    }

    // Assignment listing with course and signature summary for roles: Trainer, Learner, Employer, IQA
    public async listWithSignatures(req: CustomRequest, res: Response) {
        try {
            const { assessor_id, learner_name, search, page = 1, limit = 10 } = req.query as any;

            const qb = AppDataSource.getRepository(Assignment)
                .createQueryBuilder('a')
                .leftJoinAndSelect('a.course_id', 'course')
                .leftJoinAndSelect('a.user', 'learnerUser') // learner
                .leftJoinAndSelect('a.signatures', 'sig')
                .leftJoinAndSelect('sig.user', 'sigUser')
                .leftJoinAndSelect('sig.requested_by', 'requestedBy')
                .leftJoin(UserCourse, 'uc', 'uc.learner_id = learnerUser.user_id')
                .leftJoin('uc.trainer_id', 'trainer')
                .leftJoin('uc.employer_id', 'employer')
                .where('sig.is_requested = true');

            // Filters
            if (assessor_id) qb.andWhere('trainer.user_id = :assessor_id', { assessor_id });
            if (learner_name) {
                qb.andWhere(
                    "LOWER(learnerUser.first_name || ' ' || learnerUser.last_name) LIKE :learner_name",
                    { learner_name: `%${learner_name.toLowerCase()}%` }
                );
            }
            if (search) {
                qb.andWhere("LOWER(a.file->>'name') LIKE :search", { search: `%${search.toLowerCase()}%` });
            }

            //Pagination
            const take = Number(limit);
            const skip = (Number(page) - 1) * take;

            qb.skip(skip).take(take);
            qb.orderBy('a.created_at', 'DESC');

            const [assignments, total] = await qb.getManyAndCount();

            const result = assignments.map((a: any) => {
                const roleSig: any = {};
                (a.signatures || []).forEach((s: any) => {
                    roleSig[s.role] = {
                        id: s.id,
                        user_id: s.user?.user_id || null,
                        name: s.user ? `${s.user.first_name} ${s.user.last_name}`.trim() : null,
                        isSigned: s.is_signed,
                        signedAt: s.signed_at,
                        is_requested: s.is_requested,
                        requestedAt: s.requested_at,
                        requestedBy: s.requested_by
                            ? `${s.requested_by.first_name} ${s.requested_by.last_name}`.trim()
                            : null,
                    };
                });

                return {
                    assignment_id: a.assignment_id,
                    learner: {
                        id: a.user?.user_id || null,
                        name: a.user ? `${a.user.first_name} ${a.user.last_name}`.trim() : null,
                    },
                    course: {
                        id: a.course_id?.course_id || null,
                        name: a.course_id?.course_name || null,
                        code: a.course_id?.course_code || null,
                    },
                    employer_name: a?.employer ? `${a.employer.first_name} ${a.employer.last_name}`.trim() : null,
                    trainer_name: a?.trainer ? `${a.trainer.first_name} ${a.trainer.last_name}`.trim() : null,
                    file_type: 'Evidence',
                    file_name: (a.file as any)?.name || null,
                    file_description: a.description || null,
                    uploaded_at: a.created_at,
                    signatures: {
                        Trainer: roleSig['Trainer'] || null,
                        Learner: roleSig['Learner'] || null,
                        Employer: roleSig['Employer'] || null,
                        IQA: roleSig['IQA'] || null,
                    },
                };
            });

            return res.status(200).json({
                message: 'Assignments fetched successfully',
                status: true,
                page: Number(page),
                limit: Number(limit),
                total,              
                data: result,
            });
        } catch (error: any) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    public async CreateAssignment(req: CustomRequest, res: Response) {
        try {
            const { evidence_time_log, title, description, declaration, user_id } = req.body;

            let userId = user_id ? user_id : req.user.user_id;
            if (!req.file) {
                return res.status(400).json({
                    message: "All field is required",
                    status: false,
                });
            }
            const assignmentRepository = AppDataSource.getRepository(Assignment);

            const fileUpload = await uploadToS3(req.file, "Assignment")

            const assignment = assignmentRepository.create({
                file: {
                    name: req.file.originalname,
                    size: req.file.size,
                    ...fileUpload
                },
                user: userId,
                title,
                description,
                declaration,
                evidence_time_log: evidence_time_log || false
            })

            const savedAssignment = await assignmentRepository.save(assignment);

            res.status(200).json({
                message: "Assignment created successfully",
                status: true,
                data: savedAssignment,
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                error: error.message,
                status: false,
            });
        }
    }

    public async updateAssignment(req: CustomRequest, res: Response) {
        try {
            const AssignmentId = parseInt(req.params.id);
            const { file, declaration, description, trainer_feedback, external_feedback, learner_comments, points_for_improvement, assessment_method, session, grade, title, units, status, evidence_time_log, user_id } = req.body;
            if (!file && !declaration && !description && !trainer_feedback && !external_feedback && !learner_comments && !points_for_improvement && !assessment_method && !session && !grade && !title && !units && !status && evidence_time_log === undefined) {
                return res.status(400).json({
                    message: 'At least one field required',
                    status: false,
                });
            }

            const assignmentRepository = AppDataSource.getRepository(Assignment);

            const assignment = await assignmentRepository.findOne({
                where: { assignment_id: AssignmentId },
                relations: ['course_id', 'user']
            });

            if (!assignment) {
                return res.status(404).json({
                    message: 'assignment not found',
                    status: false,
                });
            }

            // Check authorization
            const userRoles = req.user.roles || [req.user.role];
            const isAuthorized = await AssignmentController.isUserAuthorizedForAssignment(
                req.user.user_id,
                userRoles,
                assignment
            );

            if (!isAuthorized) {
                return res.status(403).json({
                    message: "You are not authorized to update this assignment",
                    status: false
                });
            }

            let userId = user_id ? user_id : req.user.user_id;
            assignment.user = userId;

            assignment.file = file || assignment.file;
            assignment.declaration = declaration || assignment.declaration;
            assignment.description = description || assignment.description;
            assignment.title = title || assignment.title;
            assignment.evidence_time_log = evidence_time_log !== undefined ? evidence_time_log : assignment.evidence_time_log;

            const updatedAssignment = await assignmentRepository.save(assignment);

            return res.status(200).json({
                message: 'Assignment updated successfully',
                status: true,
                data: updatedAssignment,
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    public async getAssignmentBycourse(req: CustomRequest, res: Response) {
        try {
            const { user_id, course_id, search } = req.query as any;
            const assignmentRepository = AppDataSource.getRepository(Assignment);
            const userCourseRepository = AppDataSource.getRepository(UserCourse);

            // Check if the requesting user is authorized to view assignments for this course
            const requestingUserId = req.user.user_id;
            const requestingUserRoles = req.user.roles || [req.user.role];

            if (course_id && !requestingUserRoles.includes(UserRole.Admin)) {
            const userCourseInvolvement = await userCourseRepository.createQueryBuilder('user_course')
                .leftJoin('user_course.learner_id', 'learner')
                .leftJoin('learner.user_id', 'learner_user')
                .leftJoin('user_course.trainer_id', 'trainer')
                .leftJoin('user_course.IQA_id', 'IQA')
                .leftJoin('user_course.LIQA_id', 'LIQA')
                .leftJoin('user_course.EQA_id', 'EQA')
                .leftJoin('user_course.employer_id', 'employer')
                .where('(learner_user.user_id = :requestingUserId OR trainer.user_id = :requestingUserId OR IQA.user_id = :requestingUserId OR LIQA.user_id = :requestingUserId OR EQA.user_id = :requestingUserId OR employer.user_id = :requestingUserId)', { requestingUserId })
                .getOne();

            if (!userCourseInvolvement) {
                return res.status(403).json({
                    message: "You are not authorized to view assignments for this course",
                    status: false
                });
            }
        }

            const qb = assignmentRepository
                .createQueryBuilder("assignment")
                .leftJoinAndSelect("assignment.course_id", "course")
                .leftJoinAndSelect("assignment.user", "user")
                .where("user.user_id = :user_id", { user_id })
                .orderBy("assignment.created_at", "DESC")
                .skip(req.pagination.skip)
                .take(Number(req.pagination.limit));

            if (search) {
                qb.andWhere("(assignment.title ILIKE :search OR assignment.description ILIKE :search)", { search: `%${search}%` })
            }

            const [assignments, count] = await qb.getManyAndCount();


            return res.status(200).json({
                message: 'Assignment retrieved successfully',
                status: true,
                data: assignments,
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

    public async deleteAssignment(req: CustomRequest, res: Response) {
        try {
            const assignmentId = parseInt(req.params.id);
            const assignmentRepository = AppDataSource.getRepository(Assignment);
            const assignmentSignatureRepository = AppDataSource.getRepository(AssignmentSignature);
            const assignment = await assignmentRepository.findOne({
                where: { assignment_id: assignmentId },
                relations: ['course_id', 'user']
            });

            if (!assignment) {
                return res.status(404).json({
                    message: 'Assignment not found',
                    status: false,
                });
            }

            // Check authorization
            if (assignment.user.user_id !== req.user.user_id &&
                !req.user.roles.includes(UserRole.Admin)) {
                return res.status(403).json({ message: "Not authorized", status: false });
            }

            deleteFromS3(assignment.file)
            await assignmentRepository.remove(assignment);

            return res.status(200).json({
                message: 'Assignment deleted successfully',
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

    // Request a signature for an assignment for a role/user
    public async requestSignature(req: CustomRequest, res: Response) {
        try {
            const { mapping_id, role, user_id, is_requested } = req.body;

            if (is_requested === undefined) {
                return res.status(400).json({
                    status: false,
                    message: "is_requested is required"
                });
            }

            const repo = AppDataSource.getRepository(AssignmentSignature);

            let sig = await repo.findOne({
                where: {
                    mapping: { mapping_id } as any,
                    role
                }
            });

            // create row if not exists
            if (!sig) {
                sig = repo.create({
                    mapping: { mapping_id } as any,
                    role
                });
            }

            sig.is_requested = is_requested;

            if (is_requested) {
                sig.requested_at = new Date();
                sig.requested_by = { user_id: req.user.user_id } as any;
                if (user_id) sig.user = { user_id } as any;
            } else {
                // cancel request
                sig.requested_at = null;
                sig.requested_by = null;
            }


            let result = await repo.save(sig);

            return res.status(200).json({
                message: is_requested ? "Signature requested" : "Signature request cancelled",
                status: true,
                data: result
            });
        } catch (error) {
            return res.status(500).json({ message: 'Internal Server Error', status: false, error: error.message });
        }
    }

    // Mark signature as signed by current user
    public async signAssignment(req: CustomRequest, res: Response) {
        try {
            const { mapping_id, role, is_signed } = req.body;

            if (is_signed === undefined) {
                return res.status(400).json({
                    status: false,
                    message: "is_signed is required"
                });
            }

            const repo = AppDataSource.getRepository(AssignmentSignature);

            const sig = await repo.findOne({
                where: {
                    mapping: { mapping_id } as any,
                    role
                },
                relations: ["user"]
            });

            if (!sig) {
                return res.status(404).json({
                    status: false,
                    message: "Signature row not found"
                });
            }

            // permission: same signer or admin
            const isAdmin = req.user.roles?.includes(UserRole.Admin);
            if (
                is_signed &&
                !isAdmin &&
                sig.user &&
                sig.user.user_id !== req.user.user_id
            ) {
                return res.status(403).json({
                    status: false,
                    message: "Not authorised to sign"
                });
            }

            sig.is_signed = is_signed;

            if (is_signed) {
                sig.signed_at = new Date();
                sig.user = { user_id: req.user.user_id } as any;
            } else {
                // un-sign
                sig.signed_at = null;
            }
            const updated = await repo.save(sig);

            return res.status(200).json({ message: is_signed ? 'Signed successfully' : 'Signature removed', status: true, data: updated });
        } catch (error) {
            return res.status(500).json({ message: 'Internal Server Error', status: false, error: error.message });
        }
    }

    public async getAssignmentSignatures(req: CustomRequest, res: Response) {
        try {
            const assignmentId = parseInt(req.params.id);
            const signatureRepository = AppDataSource.getRepository(AssignmentSignature);
            const signatures = await signatureRepository.createQueryBuilder('sig')
                .leftJoinAndSelect('sig.user', 'user')
                .leftJoin('sig.assignment', 'assignment')
                .where('assignment.assignment_id = :assignmentId', { assignmentId })
                .leftJoinAndSelect('sig.requested_by', 'requested_by')
                .getMany();

                            
            const result = signatures.map((s: any) => {
                const requestedByUser = Array.isArray(s.requested_by) ? s.requested_by[0] : s.requested_by;
                return {
                    id: s.id,
                    role: s.role,
                    user_id: s.user?.user_id || null,
                    name: s.user ? `${s.user.first_name || ''} ${s.user.last_name || ''}`.trim() : null,
                    isSigned: s.is_signed,
                    isRequested: s.is_requested,
                    signedAt: s.signed_at,
                    requestedAt: s.requested_at,
                    //add null if requested_by is null or undefined , not in database
                    requestedBy: requestedByUser
                        ? `${requestedByUser.first_name || ''} ${requestedByUser.last_name || ''}`.trim()
                        : null,
                    requestedByNameId: requestedByUser?.user_id || null,
                    requestedByName: requestedByUser?.first_name + ' ' + requestedByUser?.last_name || null,
                };
            });

            return res.status(200).json({ message: 'Signatures fetched', status: true, data: result });
        } catch (error) {
            return res.status(500).json({ message: 'Internal Server Error', status: false, error: error.message });
        }
    }

    public async getAssignment(req: CustomRequest, res: Response) {
        try {
            const { id } = req.params as any;
            const assignmentRepository = AppDataSource.getRepository(Assignment);

            const assignment = await assignmentRepository.findOne({
                where: { assignment_id: id },
                relations: ['course_id', 'user']
            });

            if (!assignment) {
                return res.status(404).json({
                    message: "Assignment not Found",
                    status: false
                });
            }

            // Check authorization
            const userRoles = req.user.roles || [req.user.role];
            const isAuthorized = await AssignmentController.isUserAuthorizedForAssignment(
                req.user.user_id,
                userRoles,
                assignment
            );

            if (!isAuthorized) {
                return res.status(403).json({
                    message: "You are not authorized to view this assignment",
                    status: false
                });
            }

            return res.status(200).json({
                message: 'Assignment retrieved successfully',
                status: true,
                data: assignment,
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    public async reuploadAssignmentFile(req: CustomRequest, res: Response) {
        try {
            const assignmentId = parseInt(req.params.id);
            if (!req.file) {
                return res.status(400).json({
                    message: 'File is required',
                    status: false,
                });
            }

            const assignmentRepository = AppDataSource.getRepository(Assignment);
            const assignment = await assignmentRepository.findOne({
                where: { assignment_id: assignmentId },
                relations: ['user']
            });

            if (!assignment) {
                return res.status(404).json({
                    message: 'Assignment not found',
                    status: false,
                });
            }

            // Check authorization
            if (assignment.user.user_id !== req.user.user_id &&
                !req.user.roles.includes(UserRole.Admin)) {
                return res.status(403).json({ message: "Not authorized", status: false });
            }
            const fileKey = assignment.file;

            const fileUpload = await uploadToS3(req.file, 'Assignment');

            assignment.file = {
                name: req.file.originalname,
                size: req.file.size,
                ...fileUpload,
            };

            const updated = await assignmentRepository.save(assignment);
            console.log(updated)
            if (fileKey) {
                let d = await deleteFromS3(fileKey);
                console.log(d)
            }

            return res.status(200).json({
                message: 'File reuploaded successfully',
                status: true,
                data: updated,
            });

        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                error: error.message,
                status: false,
            });
        }
    }

    public async uploadAudioFeedback(req: CustomRequest, res: Response) {
        try {
            const assignmentId = parseInt(req.params.id);

            if (!req.file) {
                return res.status(400).json({
                    message: 'file is required',
                    status: false,
                });
            }

            const assignmentRepository = AppDataSource.getRepository(Assignment);
            const assignment = await assignmentRepository.findOne({
                where: { assignment_id: assignmentId },
                relations: ['course_id', 'user']
            });

            if (!assignment) {
                return res.status(404).json({
                    message: 'Assignment not found',
                    status: false,
                });
            }

            let audioFeedbackData = null;

            // Handle audio file upload
            if (req.file) {
                const audioUpload = await uploadToS3(req.file, 'AudioFeedback');
                audioFeedbackData = {
                    name: req.file.originalname,
                    size: req.file.size,
                    type: req.file.mimetype,
                    ...audioUpload,
                    uploaded_at: new Date(),
                    uploaded_by: req.user.user_id
                };
            }

            

            const updatedAssignment = await assignmentRepository.save(assignment);

            return res.status(200).json({
                message: 'Feedback uploaded successfully',
                status: true,
                data: {
                    assignment_id: updatedAssignment.assignment_id,
                    updated_at: updatedAssignment.updated_at
                },
            });

        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                error: error.message,
                status: false,
            });
        }
    }

    public async deleteAudioFeedback(req: CustomRequest, res: Response) {
        try {
            const assignmentId = parseInt(req.params.id);

            const assignmentRepository = AppDataSource.getRepository(Assignment);
            const assignment = await assignmentRepository.findOne({
                where: { assignment_id: assignmentId },
                relations: ['course_id', 'user', 'user.user_id']
            });

            if (!assignment) {
                return res.status(404).json({
                    message: 'Assignment not found',
                    status: false,
                });
            }

            

            const updatedAssignment = await assignmentRepository.save(assignment);

            return res.status(200).json({
                message: 'Audio feedback deleted successfully',
                status: true,
                data: {
                    assignment_id: updatedAssignment.assignment_id,
                    updated_at: updatedAssignment.updated_at
                },
            });

        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                error: error.message,
                status: false,
            });
        }
    }

}

export default AssignmentController;
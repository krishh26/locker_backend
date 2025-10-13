import { Response } from "express";
import { AppDataSource } from "../data-source";
import { CustomRequest } from "../util/Interface/expressInterface";
import { Assignment } from "../entity/Assignment.entity";
import { deleteFromS3, uploadToS3 } from "../util/aws";
import { UserCourse } from "../entity/UserCourse.entity";
import { UserRole } from "../util/constants";
import { AssignmentSignature } from "../entity/AssignmentSignature.entity";

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

            const courseId = assignment.course_id.course_id;

            const userCourseInvolvement = await userCourseRepository.createQueryBuilder('user_course')
                .leftJoin('user_course.learner_id', 'learner')
                .leftJoin('learner.user_id', 'learner_user')
                .leftJoin('user_course.trainer_id', 'trainer')
                .leftJoin('user_course.IQA_id', 'IQA')
                .leftJoin('user_course.LIQA_id', 'LIQA')
                .leftJoin('user_course.EQA_id', 'EQA')
                .leftJoin('user_course.employer_id', 'employer')
                .where('user_course.course->>\'course_id\' = :courseId', { courseId })
                .andWhere('(trainer.user_id = :userId OR IQA.user_id = :userId OR LIQA.user_id = :userId OR EQA.user_id = :userId OR employer.user_id = :userId)', { userId })
                .getOne();

            return !!userCourseInvolvement;
        } catch (error) {
            console.error('Error checking user authorization:', error);
            return false;
        }
    }

    public async CreateAssignment(req: CustomRequest, res: Response) {
        try {
            const { course_id, evidence_time_log, user_id } = req.body;

            let userId = user_id ? user_id : req.user.user_id;
            if (!req.file && !course_id) {
                return res.status(400).json({
                    message: "All field is required",
                    status: false,
                });
            }
            const assignmentRepository = AppDataSource.getRepository(Assignment);
            const signatureRepository = AppDataSource.getRepository(AssignmentSignature);

            const fileUpload = await uploadToS3(req.file, "Assignment")

            const assignment = assignmentRepository.create({
                file: {
                    name: req.file.originalname,
                    size: req.file.size,
                    ...fileUpload
                },
                user: userId,
                course_id,
                evidence_time_log: evidence_time_log || false
            })

            const savedAssignment = await assignmentRepository.save(assignment);

            // Initialize signature rows for key roles
            const defaultRoles = [
                'Trainer',
                'Learner',
                'Employer',
                'IQA'
            ];

            const signatureRows = defaultRoles.map((role) => {
                const row = new AssignmentSignature();
                row.assignment = savedAssignment as any;
                row.role = role;
                row.user = null;
                row.is_signed = false;
                row.is_requested = false;
                row.signed_at = null;
                row.requested_by = null as any;
                row.requested_at = null;
                return row;
            });
            await signatureRepository.save(signatureRows);

            const assignmentWithUserDetails = await assignmentRepository.findOne({
                where: { assignment_id: savedAssignment.assignment_id },
                relations: ['user']
            });

            res.status(200).json({
                message: "Assignment created successfully",
                status: true,
                data: assignmentWithUserDetails,
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
            assignment.trainer_feedback = trainer_feedback || assignment.trainer_feedback;
            assignment.external_feedback = external_feedback || assignment.external_feedback;
            assignment.learner_comments = learner_comments || assignment.learner_comments;
            assignment.points_for_improvement = points_for_improvement || assignment.points_for_improvement;
            assignment.assessment_method = assessment_method || assignment.assessment_method;
            assignment.session = session || assignment.session;
            assignment.grade = grade || assignment.grade;
            assignment.title = title || assignment.title;
            assignment.units = units || assignment.units;
            assignment.status = status || assignment.status;
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
                .where('user_course.course->>\'course_id\' = :course_id', { course_id })
                .andWhere('(learner_user.user_id = :requestingUserId OR trainer.user_id = :requestingUserId OR IQA.user_id = :requestingUserId OR LIQA.user_id = :requestingUserId OR EQA.user_id = :requestingUserId OR employer.user_id = :requestingUserId)', { requestingUserId })
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

            if (course_id) {
                qb.andWhere("assignment.course_id = :course_id", { course_id });
            }

            if (search) {
                qb.andWhere("(assignment.title ILIKE :search OR assignment.description ILIKE :search)", { search: `%${search}%` })
            }

            const [assignments, count] = await qb
                .select([
                    "assignment",
                    "course.course_id",
                    "course.course_name",
                    "course.course_code"
                ])
                .getManyAndCount();


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
            const userRoles = req.user.roles || [req.user.role];
            const isAuthorized = await AssignmentController.isUserAuthorizedForAssignment(
                req.user.user_id,
                userRoles,
                assignment
            );

            if (!isAuthorized) {
                return res.status(403).json({
                    message: "You are not authorized to delete this assignment",
                    status: false
                });
            }

            deleteFromS3(assignment.file)
            await assignmentSignatureRepository.delete({ assignment: { assignment_id: assignmentId } });
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
            const assignmentId = parseInt(req.params.id);
            // add is requested field for all role separately in signature table
            const { role, roles, user_id } = req.body as any;

            const signatureRepository = AppDataSource.getRepository(AssignmentSignature);
            const assignmentRepository = AppDataSource.getRepository(Assignment);
            const userCourseRepository = AppDataSource.getRepository(UserCourse);

            const assignment = await assignmentRepository.findOne({ where: { assignment_id: assignmentId }, relations: ['course_id', 'user'] });
            if (!assignment) {
                return res.status(404).json({ message: 'Assignment not found', status: false });
            }

            // Only trainers assigned to this course or Admin can request
            //const courseId = assignment.course_id.course_id;
            // const isAdmin = (req.user.roles || [req.user.role]).includes(UserRole.Admin);
            // let authorized = isAdmin;
            // if (!authorized) {
            //     const trainerInvolvement = await userCourseRepository.createQueryBuilder('user_course')
            //         .leftJoin('user_course.trainer_id', 'trainer')
            //         .where('user_course.course->>\'course_id\' = :courseId', { courseId })
            //         .andWhere('trainer.user_id = :userId', { userId: req.user.user_id })
            //         .getOne();
            //     authorized = !!trainerInvolvement;
            // }
            // if (!authorized) {
            //     return res.status(403).json({ message: 'Not authorized to request signatures', status: false });
            // }

            const rolesToProcess: string[] = Array.isArray(roles) && roles.length ? roles : (role ? [role] : []);
            if (!rolesToProcess.length) {
                return res.status(400).json({ message: 'role or roles[] is required', status: false });
            }

            // Fetch all signature rows for this assignment
            const allSignatures = await signatureRepository.find({ 
            where: { assignment: { assignment_id: assignmentId } } 
            });
            console.log(allSignatures)
            const results: any[] = [];
            const notFound: string[] = [];

            for (const sig of allSignatures) {
                // Set true if role is in request array, otherwise false
                const shouldRequest = rolesToProcess.includes(sig.role);
    
                sig.is_requested = shouldRequest;
                sig.requested_at = shouldRequest ? new Date() : null;
                sig.requested_by = shouldRequest ? { user_id: req.user.user_id } as any : null;
    
                if (user_id) {
                    sig.user = { user_id } as any;
                }
    
                const updated = await signatureRepository.save(sig);
                results.push(updated);
            }

            return res.status(200).json({
                message: 'Signature request(s) processed',
                status: true,
                data: results,
                ...(notFound.length ? { not_found_roles: notFound } : {})
            });
        } catch (error) {
            return res.status(500).json({ message: 'Internal Server Error', status: false, error: error.message });
        }
    }

    // Mark signature as signed by current user
    public async signAssignment(req: CustomRequest, res: Response) {
        try {
            const assignmentId = parseInt(req.params.id);
            const { role, is_signed } = req.body as any;

            const signatureRepository = AppDataSource.getRepository(AssignmentSignature);
            const assignmentRepository = AppDataSource.getRepository(Assignment);
            const userCourseRepository = AppDataSource.getRepository(UserCourse);

            const assignment = await assignmentRepository.findOne({ where: { assignment_id: assignmentId }, relations: ['course_id', 'user'] });
            if (!assignment) {
                return res.status(404).json({ message: 'Assignment not found', status: false });
            }

            // Permission checks per role
            const userId = req.user.user_id;
            const roles = req.user.roles || [req.user.role];
            const isAdmin = roles.includes(UserRole.Admin);

            let canSign = false;
            if (role === 'Learner') {
                canSign = assignment.user.user_id === userId || isAdmin;
            } else if (role === 'Employer') {
                // Employer mapped on user_course for this course
                const courseId = assignment.course_id.course_id;
                const employerInvolvement = await userCourseRepository.createQueryBuilder('user_course')
                    .leftJoin('user_course.employer_id', 'employer')
                    .where('user_course.course->>\'course_id\' = :courseId', { courseId })
                    .andWhere('employer.user_id = :userId', { userId })
                    .getOne();
                canSign = !!employerInvolvement || isAdmin;
            } else if (role === 'IQA') {
                const courseId = assignment.course_id.course_id;
                const iqaInvolvement = await userCourseRepository.createQueryBuilder('user_course')
                    .leftJoin('user_course.IQA_id', 'IQA')
                    .where('user_course.course->>\'course_id\' = :courseId', { courseId })
                    .andWhere('IQA.user_id = :userId', { userId })
                    .getOne();
                canSign = !!iqaInvolvement || isAdmin;
            } else if (role === 'Trainer') {
                const courseId = assignment.course_id.course_id;
                const trainerInvolvement = await userCourseRepository.createQueryBuilder('user_course')
                    .leftJoin('user_course.trainer_id', 'trainer')
                    .where('user_course.course->>\'course_id\' = :courseId', { courseId })
                    .andWhere('trainer.user_id = :userId', { userId })
                    .getOne();
                canSign = !!trainerInvolvement || isAdmin;
            }

            if (!canSign) {
                return res.status(403).json({ message: 'Not authorized to sign for this role', status: false });
            }

            const signatureRow = await signatureRepository.createQueryBuilder('sig')
                .leftJoin('sig.assignment', 'assignment')
                .where('assignment.assignment_id = :assignmentId', { assignmentId })
                .andWhere('sig.role = :role', { role })
                .getOne();

            if (!signatureRow) {
                return res.status(404).json({ message: 'Signature row not found for role', status: false });
            }

            const shouldSign = (typeof is_signed === 'boolean') ? is_signed : true;
            signatureRow.is_signed = shouldSign;
            if (shouldSign) {
                signatureRow.signed_at = new Date();
                // Ensure user recorded on sign
                signatureRow.user = { user_id: userId } as any;
            } else {
                signatureRow.signed_at = null as any;
            }
            const updated = await signatureRepository.save(signatureRow);

            return res.status(200).json({ message: shouldSign ? 'Signed successfully' : 'Signature removed', status: true, data: updated });
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
                relations: ['course_id', 'user']
            });

            if (!assignment) {
                return res.status(404).json({
                    message: 'Assignment not found',
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
                    message: "You are not authorized to reupload files for this assignment",
                    status: false
                });
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

            // Update assignment with feedback
            if (audioFeedbackData) {
                assignment.external_feedback = audioFeedbackData;
            }

            const updatedAssignment = await assignmentRepository.save(assignment);

            return res.status(200).json({
                message: 'Feedback uploaded successfully',
                status: true,
                data: {
                    assignment_id: updatedAssignment.assignment_id,
                    trainer_feedback: updatedAssignment.trainer_feedback,
                    external_feedback: updatedAssignment.external_feedback,
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

            if (!assignment.external_feedback) {
                return res.status(404).json({
                    message: 'No audio feedback found to delete',
                    status: false,
                });
            }

            // Delete audio file from S3
            await deleteFromS3(assignment.external_feedback);

            // Remove audio feedback from assignment
            assignment.external_feedback = null;
            const updatedAssignment = await assignmentRepository.save(assignment);

            return res.status(200).json({
                message: 'Audio feedback deleted successfully',
                status: true,
                data: {
                    assignment_id: updatedAssignment.assignment_id,
                    external_feedback: updatedAssignment.external_feedback,
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
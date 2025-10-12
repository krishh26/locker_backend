import { Response } from "express";
import { AppDataSource } from "../data-source";
import { CustomRequest } from "../util/Interface/expressInterface";
import { Assignment } from "../entity/Assignment.entity";
import { deleteFromS3, uploadToS3 } from "../util/aws";
import { UserCourse } from "../entity/UserCourse.entity";
import { UserRole } from "../util/constants";

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

            const assignmentWithUserDetails = await assignmentRepository.findOne({
                where: { assignment_id: savedAssignment.assignment_id },
                relations: ['user', 'user.user_id']
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
                relations: ['course_id', 'user', 'user.user_id']
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
            const { user_id, course_id } = req.query as any;
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
                .leftJoinAndSelect("user.user_id", "user_id")
                .where("user.user_id = :user_id", { user_id });

            if (course_id) {
                qb.andWhere("assignment.course_id = :course_id", { course_id });
            }

            const assignments = await qb
                .select([
                    "assignment",
                    "course.course_id",
                    "course.course_name",
                    "course.course_code"
                ])
                .getMany();


            return res.status(200).json({
                message: 'Assignment retrieved successfully',
                status: true,
                data: assignments,
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

    public async getAssignment(req: CustomRequest, res: Response) {
        try {
            const { id } = req.params as any;
            const assignmentRepository = AppDataSource.getRepository(Assignment);

            const assignment = await assignmentRepository.findOne({
                where: { assignment_id: id },
                relations: ['course_id', 'user', 'user.user_id']
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
                relations: ['course_id', 'user', 'user.user_id']
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
                relations: ['course_id', 'user', 'user.user_id']
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
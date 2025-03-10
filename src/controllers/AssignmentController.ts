import { Response } from "express";
import { AppDataSource } from "../data-source";
import { CustomRequest } from "../util/Interface/expressInterface";
import { Assignment } from "../entity/Assignment.entity";
import { deleteFromS3, uploadToS3 } from "../util/aws";

class AssignmentController {

    public async CreateAssignment(req: CustomRequest, res: Response) {
        try {
            const { course_id } = req.body;
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
                    ...fileUpload
                },
                user: req.user.user_id,
                course_id
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
            const { file, declaration, description, trainer_feedback, learner_comments, points_for_improvement, assessment_method, session, grade, title, units, status } = req.body;
            if (!file && !declaration && !description && !trainer_feedback && !learner_comments && !points_for_improvement && !assessment_method && !session && !grade && !title && !units && !status) {
                return res.status(400).json({
                    message: 'At least one field required',
                    status: false,
                });
            }

            const assignmentRepository = AppDataSource.getRepository(Assignment);

            const assignment = await assignmentRepository.findOne({ where: { assignment_id: AssignmentId } });

            if (!assignment) {
                return res.status(404).json({
                    message: 'assignment not found',
                    status: false,
                });
            }

            assignment.file = file || assignment.file;
            assignment.declaration = declaration || assignment.declaration;
            assignment.description = description || assignment.description;
            assignment.trainer_feedback = trainer_feedback || assignment.trainer_feedback;
            assignment.learner_comments = learner_comments || assignment.learner_comments;
            assignment.points_for_improvement = points_for_improvement || assignment.points_for_improvement;
            assignment.assessment_method = assessment_method || assignment.assessment_method;
            assignment.session = session || assignment.session;
            assignment.grade = grade || assignment.grade;
            assignment.title = title || assignment.title;
            assignment.units = units || assignment.units;
            assignment.status = status || assignment.status;

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

            const assignments = await assignmentRepository.find({ where: { course_id, user: { user_id } } })

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

            const assignment = await assignmentRepository.findOne({ where: { assignment_id: assignmentId } });

            if (!assignment) {
                return res.status(404).json({
                    message: 'Assingment not found',
                    status: false,
                });
            }

            deleteFromS3(assignment.file)
            await assignmentRepository.remove(assignment);

            return res.status(200).json({
                message: 'Assingment deleted successfully',
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

            const assignment = await assignmentRepository.findOne({ where: { assignment_id: id }, relations: ['course_id', 'user'] })
            if (!assignment) {
                return res.status(404).json({
                    message: "Assignment not Found",
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
}

export default AssignmentController;
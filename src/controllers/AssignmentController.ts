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
import { AssignmentMapping } from "../entity/AssignmentMapping.entity";
import { AssessmentStatus } from "../util/constants";
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

            const qb = AppDataSource.getRepository(AssignmentMapping)
                .createQueryBuilder('am')
                .leftJoinAndSelect('am.assignment', 'a')
                .leftJoinAndSelect('a.user', 'learnerUser')
                .leftJoinAndSelect('am.course', 'course')
                .leftJoinAndSelect('am.signatures', 'sig')
                .leftJoinAndSelect('sig.user', 'sigUser')
                .leftJoinAndSelect('sig.requested_by', 'requestedBy')
                .leftJoin(UserCourse, 'uc', 'uc.learner_id = learnerUser.user_id')
                .leftJoin('uc.trainer_id', 'trainer')
                .leftJoin('uc.employer_id', 'employer')
                .where('sig.is_requested = true');

            // Filters
            if (assessor_id) {
                qb.andWhere('trainer.user_id = :assessor_id', { assessor_id });
            }

            if (learner_name) {
                qb.andWhere(
                    "LOWER(learnerUser.first_name || ' ' || learnerUser.last_name) LIKE :learner_name",
                    { learner_name: `%${learner_name.toLowerCase()}%` }
                );
            }

            if (search) {
                qb.andWhere(
                    "LOWER(a.file->>'name') LIKE :search",
                    { search: `%${search.toLowerCase()}%` }
                );
            }

            // Pagination
            const take = Number(limit);
            const skip = (Number(page) - 1) * take;

            qb.skip(skip).take(take);
            qb.orderBy('a.created_at', 'DESC');

            const [rows, total] = await qb.getManyAndCount();

            const result = rows.map((am: any) => {
                const a = am.assignment;

                const roleSig: any = {};
                (am.signatures || []).forEach((s: any) => {
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
                    mapping_id: am.mapping_id,
                    learner: {
                        id: a.user?.user_id || null,
                        name: a.user ? `${a.user.first_name} ${a.user.last_name}`.trim() : null,
                    },
                    course: {
                        id: am.course?.course_id || null,
                        name: am.course?.course_name || null,
                        code: am.course?.course_code || null,
                    },
                    employer_name: a.employer
                        ? `${a.employer.first_name} ${a.employer.last_name}`.trim()
                        : null,
                    trainer_name: a.trainer
                        ? `${a.trainer.first_name} ${a.trainer.last_name}`.trim()
                        : null,
                    file_type: 'Evidence',
                    file_name: a.file?.name || null,
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
                evidence_time_log: evidence_time_log || false,
                status: AssessmentStatus.NotStarted
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
            const AssignmentId = Number(req.params.id);
            const {
                file,
                declaration,
                description,
                trainer_feedback,
                external_feedback,
                learner_comments,
                points_for_improvement,
                assessment_method,
                session,
                grade,
                title,
                status,
                evidence_time_log,
                user_id,
            } = req.body;

            if (
                !file &&
                declaration === undefined &&
                !description &&
                !trainer_feedback &&
                !external_feedback &&
                !learner_comments &&
                !points_for_improvement &&
                !assessment_method &&
                !session &&
                !grade &&
                !title &&
                !status &&
                evidence_time_log === undefined
            ) {
                return res.status(400).json({
                    message: "At least one field required",
                    status: false,
                });
            }

            const assignmentRepository = AppDataSource.getRepository(Assignment);

            const assignment = await assignmentRepository.findOne({
                where: { assignment_id: AssignmentId },
                relations: ["user"], // course removed
            });

            if (!assignment) {
                return res.status(404).json({
                    message: "Assignment not found",
                    status: false,
                });
            }

            // Authorization (unchanged)
            const userRoles = req.user.roles || [req.user.role];
            const isAuthorized =
                await AssignmentController.isUserAuthorizedForAssignment(
                    req.user.user_id,
                    userRoles,
                    assignment
                );

            if (!isAuthorized) {
                return res.status(403).json({
                    message: "You are not authorized to update this assignment",
                    status: false,
                });
            }

            // ✅ Update evidence-level fields
            assignment.user = user_id ? user_id : assignment.user;
            assignment.file = file || assignment.file;
            assignment.declaration =
                declaration !== undefined ? declaration : assignment.declaration;
            assignment.description = description || assignment.description;
            assignment.title = title || assignment.title;
            assignment.evidence_time_log =
                evidence_time_log !== undefined
                    ? evidence_time_log
                    : assignment.evidence_time_log;

            assignment.trainer_feedback =
                trainer_feedback ?? assignment.trainer_feedback;
            assignment.external_feedback =
                external_feedback ?? assignment.external_feedback;
            assignment.learner_comments =
                learner_comments ?? assignment.learner_comments;
            assignment.points_for_improvement =
                points_for_improvement ?? assignment.points_for_improvement;
            assignment.assessment_method =
                assessment_method ?? assignment.assessment_method;
            assignment.session = session ?? assignment.session;
            assignment.grade = grade ?? assignment.grade;
            assignment.status = status ?? assignment.status;

            const updatedAssignment = await assignmentRepository.save(assignment);

            return res.status(200).json({
                message: "Assignment updated successfully",
                status: true,
                data: updatedAssignment,
            });
        } catch (error: any) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message,
            });
        }
    }

    public async getAssignmentBycourse(req: CustomRequest, res: Response) {
        try {
            const { user_id, course_id, search } = req.query as any;

            const assignmentRepo = AppDataSource.getRepository(Assignment);
            const mappingRepo = AppDataSource.getRepository(AssignmentMapping);
            const userCourseRepo = AppDataSource.getRepository(UserCourse);

            const requestingUserId = req.user.user_id;
            const requestingUserRoles = req.user.roles || [req.user.role];

            /* ================= AUTH CHECK ================= */
            if (
                course_id &&
                !requestingUserRoles.includes(UserRole.Admin) &&
                !requestingUserRoles.includes(UserRole.Learner)
            ) {
                const userCourseInvolvement = await userCourseRepo
                    .createQueryBuilder("uc")
                    .leftJoin("uc.learner_id", "learner")
                    .leftJoin("learner.user_id", "learner_user")
                    .leftJoin("uc.trainer_id", "trainer")
                    .leftJoin("uc.IQA_id", "IQA")
                    .leftJoin("uc.LIQA_id", "LIQA")
                    .leftJoin("uc.EQA_id", "EQA")
                    .leftJoin("uc.employer_id", "employer")
                    .where(
                        `(learner_user.user_id = :uid
            OR trainer.user_id = :uid
            OR IQA.user_id = :uid
            OR LIQA.user_id = :uid
            OR EQA.user_id = :uid
            OR employer.user_id = :uid)`,
                        { uid: requestingUserId }
                    )
                    .getOne();

                if (!userCourseInvolvement) {
                    return res.status(403).json({
                        status: false,
                        message: "You are not authorized to view assignments for this course",
                    });
                }
            }

            /* ================= STEP 1: COURSE FILTER (ONLY IF course_id EXISTS) ================= */
            let allowedAssignmentIds: number[] | null = null;

            if (course_id) {
                const mappedAssignments = await mappingRepo
                    .createQueryBuilder("m")
                    .leftJoin("m.assignment", "assignment")
                    .leftJoin("m.course", "course")
                    .where("course.course_id = :course_id", {
                        course_id: Number(course_id),
                    })
                    .select("assignment.assignment_id", "assignment_id")
                    .distinct(true)
                    .getRawMany();

                allowedAssignmentIds = mappedAssignments.map(
                    (m) => m.assignment_id
                );

                if (!allowedAssignmentIds.length) {
                    return res.status(200).json({
                        status: true,
                        data: [],
                    });
                }
            }

            /* ================= STEP 2: FETCH ASSIGNMENTS ================= */
            const assignmentQB = assignmentRepo
                .createQueryBuilder("assignment")
                .leftJoinAndSelect("assignment.user", "user")
                .where("user.user_id = :user_id", { user_id })
                .orderBy("assignment.created_at", "DESC")
                .skip(req.pagination.skip)
                .take(Number(req.pagination.limit));

            if (allowedAssignmentIds) {
                assignmentQB.andWhere(
                    "assignment.assignment_id IN (:...ids)",
                    { ids: allowedAssignmentIds }
                );
            }

            if (search) {
                assignmentQB.andWhere(
                    "(assignment.title ILIKE :search OR assignment.description ILIKE :search)",
                    { search: `%${search}%` }
                );
            }

            const [assignments, count] = await assignmentQB.getManyAndCount();

            /* ================= STEP 3: FETCH & ATTACH MAPPINGS ================= */
            const assignmentIds = assignments.map(a => a.assignment_id);

            let mappings: AssignmentMapping[] = [];

            if (assignmentIds.length) {
                const mappingQB = mappingRepo
                    .createQueryBuilder("m")
                    .leftJoinAndSelect("m.course", "course")
                    .leftJoinAndSelect("m.assignment", "assignment")
                    .where("assignment.assignment_id IN (:...ids)", {
                        ids: assignmentIds,
                    });

                if (course_id) {
                    mappingQB.andWhere("course.course_id = :course_id", {
                        course_id: Number(course_id),
                    });
                }

                mappings = await mappingQB.getMany();
            }

            const mappingByAssignment = new Map<number, AssignmentMapping[]>();

            mappings.forEach(m => {
                const aid = m.assignment.assignment_id;
                if (!mappingByAssignment.has(aid)) {
                    mappingByAssignment.set(aid, []);
                }
                mappingByAssignment.get(aid)!.push(m);
            });

            const result = assignments.map(a => ({
                ...a,
                mappings: mappingByAssignment.get(a.assignment_id) || [],
            }));

            /* ================= RESPONSE ================= */
            return res.status(200).json({
                status: true,
                message: "Assignments retrieved successfully",
                data: result,
                ...(req.query.meta === "true" && {
                    meta_data: {
                        page: req.pagination.page,
                        items: count,
                        page_size: req.pagination.limit,
                        pages: Math.ceil(count / req.pagination.limit),
                    },
                }),
            });

        } catch (error: any) {
            return res.status(500).json({
                status: false,
                message: "Internal Server Error",
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
            const assignmentId = parseInt(req.params.id);
            const { role, roles } = req.body as any;

            const signatureRepo = AppDataSource.getRepository(AssignmentSignature);
            const assignmentRepo = AppDataSource.getRepository(Assignment);

            // Validate assignment
            const assignment = await assignmentRepo.findOne({
                where: { assignment_id: assignmentId },
            });

            if (!assignment) {
                return res.status(404).json({
                    message: 'Assignment not found',
                    status: false,
                });
            }

            // Resolve roles
            const rolesToProcess: string[] =
                Array.isArray(roles) && roles.length
                    ? roles
                    : role
                        ? [role]
                        : [];

            if (!rolesToProcess.length) {
                return res.status(400).json({
                    message: 'role or roles[] is required',
                    status: false,
                });
            }

            // Permission: only Trainer / Admin can request
            //const requesterRoles = req.user.roles || [req.user.role];
            //const isAdmin = requesterRoles.includes(UserRole.Admin);

            // if (!isAdmin && !requesterRoles.includes(UserRole.Trainer)) {
            //     return res.status(403).json({
            //         message: 'Not authorised to request signatures',
            //         status: false,
            //     });
            // }

            // Fetch signature rows via mapping → assignment
            const signatures = await signatureRepo
                .createQueryBuilder('sig')
                .leftJoin('sig.mapping', 'mapping')
                .leftJoin('mapping.assignment', 'assignment')
                .where('assignment.assignment_id = :assignmentId', { assignmentId })
                .getMany();

            if (!signatures.length) {
                return res.status(404).json({
                    message: 'No signature rows found for assignment',
                    status: false,
                });
            }

            const results: AssignmentSignature[] = [];

            // Update request flags
            for (const sig of signatures) {
                const shouldRequest = rolesToProcess.includes(sig.role);

                sig.is_requested = shouldRequest;
                sig.requested_at = shouldRequest ? new Date() : null;
                sig.requested_by = shouldRequest
                    ? ({ user_id: req.user.user_id } as any)
                    : null;

                // ❌ DO NOT touch sig.user here

                const updated = await signatureRepo.save(sig);
                results.push(updated);
            }

            return res.status(200).json({
                message: 'Signature request(s) processed',
                status: true,
                data: results,
            });
        } catch (error: any) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    // Mark signature as signed by current user
    public async signAssignment(req: CustomRequest, res: Response) {
        try {
            const assignmentId = parseInt(req.params.id);
            const { role, is_signed } = req.body as any;

            const signatureRepo = AppDataSource.getRepository(AssignmentSignature);
            const assignmentRepo = AppDataSource.getRepository(Assignment);
            const mappingRepo = AppDataSource.getRepository(AssignmentMapping);
            const userCourseRepo = AppDataSource.getRepository(UserCourse);

            // Validate assignment
            const assignment = await assignmentRepo.findOne({
                where: { assignment_id: assignmentId },
                relations: ['user'],
            });

            if (!assignment) {
                return res.status(404).json({
                    message: 'Assignment not found',
                    status: false,
                });
            }

            const userId = req.user.user_id;
            const roles = req.user.roles || [req.user.role];
            const isAdmin = roles.includes(UserRole.Admin);

            // Permission checks
            let canSign = false;

            // Learner = owner of assignment
            if (role === 'Learner') {
                canSign = assignment.user.user_id === userId || isAdmin;
            }
            // Trainer / Employer / IQA / EQA
            else {
                // Get courses where this assignment is mapped
                const mappings = await mappingRepo
                    .createQueryBuilder('m')
                    .leftJoinAndSelect('m.course', 'course')
                    .where('m.assignment.assignment_id = :assignmentId', { assignmentId })
                    .getMany();

                const courseIds = mappings.map(m => m.course.course_id);

                if (!courseIds.length) {
                    return res.status(403).json({
                        message: 'No course mappings found for assignment',
                        status: false,
                    });
                }

                const qb = userCourseRepo.createQueryBuilder('uc')
                    .where('uc.course IN (:...courseIds)', { courseIds });

                if (role === 'Trainer') {
                    qb.leftJoin('uc.trainer_id', 'r').andWhere('r.user_id = :userId', { userId });
                }
                if (role === 'Employer') {
                    qb.leftJoin('uc.employer_id', 'r').andWhere('r.user_id = :userId', { userId });
                }
                if (role === 'IQA') {
                    qb.leftJoin('uc.IQA_id', 'r').andWhere('r.user_id = :userId', { userId });
                }
                if (role === 'EQA') {
                    qb.leftJoin('uc.EQA_id', 'r').andWhere('r.user_id = :userId', { userId });
                }

                const involvement = await qb.getOne();
                canSign = !!involvement || isAdmin;
            }

            if (!canSign) {
                return res.status(403).json({
                    message: 'Not authorized to sign for this role',
                    status: false,
                });
            }

            // Fetch signature row (assignment-level via mapping)
            const signatureRow = await signatureRepo
                .createQueryBuilder('sig')
                .leftJoin('sig.mapping', 'mapping')
                .leftJoin('mapping.assignment', 'assignment')
                .where('assignment.assignment_id = :assignmentId', { assignmentId })
                .andWhere('sig.role = :role', { role })
                .getOne();

            if (!signatureRow) {
                return res.status(404).json({
                    message: 'Signature row not found for role',
                    status: false,
                });
            }

            // Sign / un-sign
            const shouldSign = typeof is_signed === 'boolean' ? is_signed : true;

            signatureRow.is_signed = shouldSign;
            signatureRow.signed_at = shouldSign ? new Date() : null;

            if (shouldSign) {
                signatureRow.user = { user_id: userId } as any;
            }

            const updated = await signatureRepo.save(signatureRow);

            return res.status(200).json({
                message: shouldSign ? 'Signed successfully' : 'Signature removed',
                status: true,
                data: updated,
            });
        } catch (error: any) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    public async getAssignmentSignatures(req: CustomRequest, res: Response) {
        try {
            const assignmentId = parseInt(req.params.id);

            const signatureRepository = AppDataSource.getRepository(AssignmentSignature);

            const signatures = await signatureRepository
                .createQueryBuilder('sig')
                .leftJoinAndSelect('sig.user', 'user')
                .leftJoinAndSelect('sig.requested_by', 'requested_by')
                .leftJoin('sig.mapping', 'mapping')              
                .leftJoin('mapping.assignment', 'assignment')    
                .where('assignment.assignment_id = :assignmentId', { assignmentId })
                .getMany();

            const result = signatures.map((s: any) => {
                const requestedByUser = s.requested_by || null;

                return {
                    id: s.id,
                    role: s.role,
                    user_id: s.user?.user_id || null,
                    name: s.user
                        ? `${s.user.first_name || ''} ${s.user.last_name || ''}`.trim()
                        : null,
                    isSigned: s.is_signed,
                    isRequested: s.is_requested,
                    signedAt: s.signed_at,
                    requestedAt: s.requested_at,
                    requestedBy: requestedByUser
                        ? `${requestedByUser.first_name || ''} ${requestedByUser.last_name || ''}`.trim()
                        : null,
                    requestedByNameId: requestedByUser?.user_id || null,
                    requestedByName: requestedByUser
                        ? `${requestedByUser.first_name} ${requestedByUser.last_name}`
                        : null,
                };
            });

            return res.status(200).json({
                message: 'Signatures fetched',
                status: true,
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

    public async getAssignment(req: CustomRequest, res: Response) {
        try {
            const { id } = req.params as any;
            const assignmentRepository = AppDataSource.getRepository(Assignment);
            const mappingRepo = AppDataSource.getRepository(AssignmentMapping);
            const signatureRepo = AppDataSource.getRepository(AssignmentSignature);
            const assignment = await assignmentRepository.findOne({
                where: { assignment_id: Number(id) },
                relations: ['user'], // evidence owner only
            });

            if (!assignment) {
                return res.status(404).json({
                    message: "Assignment not Found",
                    status: false,
                });
            }

            // Authorization (unchanged)
            const userRoles = req.user.roles || [req.user.role];
            const isAuthorized =
                await AssignmentController.isUserAuthorizedForAssignment(
                    req.user.user_id,
                    userRoles,
                    assignment
                );

            if (!isAuthorized) {
                return res.status(403).json({
                    message: "You are not authorized to view this assignment",
                    status: false,
                });
            }

            // add mapping all details including course id
            const mappings = await mappingRepo.find({
                where: { assignment: { assignment_id: assignment.assignment_id } as any },
                relations: ['course']
            });
            const mappingDetails = mappings.map((m: any) => ({
                mapping_id: m.mapping_id,
                unit_code: m.unit_code,
                sub_unit_id: m.sub_unit_id,
                course_id: m.course.course_id,
                learner_map: m.learnerMap,
                trainer_map: m.trainerMap,
                comment: m.comment,
                comment_updated_by: m.comment_updated_by,
                comment_updated_at: m.comment_updated_at
            }));

            // add signature details
            const signatures = await signatureRepo
                .createQueryBuilder('sig')
                .leftJoin('sig.mapping', 'mapping')
                .leftJoin('mapping.assignment', 'assignment')
                .where('assignment.assignment_id = :assignmentId', { assignmentId: assignment.assignment_id })
                .getMany();
            // Return FULL evidence object
            return res.status(200).json({
                message: "Assignment retrieved successfully",
                status: true,
                data: {
                    assignment_id: assignment.assignment_id,
                    user: assignment.user,

                    // file + basic info
                    file: assignment.file,
                    title: assignment.title,
                    description: assignment.description,
                    declaration: assignment.declaration,

                    // 🔑 Smart Assessor evidence-level fields
                    trainer_feedback: assignment.trainer_feedback,
                    external_feedback: assignment.external_feedback,
                    learner_comments: assignment.learner_comments,
                    points_for_improvement: assignment.points_for_improvement,
                    assessment_method: assignment.assessment_method,
                    session: assignment.session,
                    grade: assignment.grade,
                    status: assignment.status,
                    mappings: mappingDetails,
                    signatures: signatures,
                    created_at: assignment.created_at,
                    updated_at: assignment.updated_at,
                },
            });
        } catch (error: any) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message,
            });
        }
    }

    public async reuploadAssignmentFile(req: CustomRequest, res: Response) {
        try {
            const assignmentId = Number(req.params.id);

            if (!req.file) {
                return res.status(400).json({
                    message: "File is required",
                    status: false,
                });
            }

            const assignmentRepository = AppDataSource.getRepository(Assignment);

            const assignment = await assignmentRepository.findOne({
                where: { assignment_id: assignmentId },
                relations: ["user"],
            });

            if (!assignment) {
                return res.status(404).json({
                    message: "Assignment not found",
                    status: false,
                });
            }

            // 🔐 Authorization
            if (
                assignment.user.user_id !== req.user.user_id &&
                !req.user.roles?.includes(UserRole.Admin)
            ) {
                return res.status(403).json({
                    message: "Not authorized",
                    status: false,
                });
            }

            // 🔹 store old key
            const oldKey = (assignment.file as any)?.key;

            // 🔹 upload new file
            const fileUpload = await uploadToS3(req.file, "Assignment");

            assignment.file = {
                name: req.file.originalname,
                size: req.file.size,
                ...fileUpload,
            };

            const updated = await assignmentRepository.save(assignment);

            // 🔹 delete old file (if exists)
            if (oldKey) {
                await deleteFromS3(oldKey);
            }

            return res.status(200).json({
                message: "File reuploaded successfully",
                status: true,
                data: updated,
            });
        } catch (error: any) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message,
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

    public async mapAssignment(req: CustomRequest, res: Response) {
        try {
            const {
                assignment_id,
                course_id,
                unit_code,
                sub_unit_ids = [],
                mapped_by,
                learnerMap,
                trainerMap
            } = req.body;

            if (!assignment_id || !course_id || !unit_code) {
                return res.status(400).json({
                    status: false,
                    message: "assignment_id, course_id and unit_code are required"
                });
            }

            const assignmentRepo = AppDataSource.getRepository(Assignment);
            const mappingRepo = AppDataSource.getRepository(AssignmentMapping);

            const assignment = await assignmentRepo.findOne({
                where: { assignment_id }
            });

            if (!assignment) {
                return res.status(404).json({
                    status: false,
                    message: "Assignment not found"
                });
            }

            const isLearner = mapped_by === "Learner";
            const rows: AssignmentMapping[] = [];

            // Sub-unit based mapping
            if (sub_unit_ids.length) {
                for (const sid of sub_unit_ids) {
                    let row = await mappingRepo.findOne({
                        where: {
                            assignment: { assignment_id } as any,
                            course: { course_id } as any,
                            unit_code,
                            sub_unit_id: sid
                        }
                    });

                    if (!row) {
                        row = mappingRepo.create({
                            assignment,
                            course: { course_id } as any,
                            unit_code,
                            sub_unit_id: sid
                        });
                    }

                    row.learnerMap = learnerMap !== undefined ? learnerMap : isLearner;
                    row.trainerMap = trainerMap !== undefined ? trainerMap : !isLearner;

                    rows.push(row);
                }
            }
            // Unit-only mapping
            else {
                let row = await mappingRepo.findOne({
                    where: {
                        assignment: { assignment_id } as any,
                        course: { course_id } as any,
                        unit_code,
                        sub_unit_id: null
                    }
                });

                if (!row) {
                    row = mappingRepo.create({
                        assignment,
                        course: { course_id } as any,
                        unit_code,
                        sub_unit_id: null
                    });
                }

                row.learnerMap = learnerMap !== undefined ? learnerMap : isLearner;
                row.trainerMap = trainerMap !== undefined ? trainerMap : !isLearner;

                rows.push(row);
            }

            const saved = await mappingRepo.save(rows);

            return res.status(200).json({
                status: true,
                message: "Evidence mapped successfully",
                data: saved
            });

        } catch (error: any) {
            return res.status(500).json({
                status: false,
                message: "Internal Server Error",
                error: error.message
            });
        }
    }

    public async getMappedEvidence(req: CustomRequest, res: Response) {
        try {
            const { course_id, unit_code, user_id } = req.query as any;

            if (!course_id || !unit_code || !user_id) {
                return res.status(400).json({
                    status: false,
                    message: "course_id, unit_code and user_id are required",
                });
            }

            const repo = AppDataSource.getRepository(AssignmentMapping);

            const mappings = await repo.find({
                where: {
                    course: { course_id: Number(course_id) } as any,
                    unit_code,
                    learnerMap: true,
                },
                relations: ["assignment", "assignment.user"],
                order: { created_at: "DESC" },
            });

            const data = mappings
                .filter(
                    (m) => m.assignment?.user?.user_id === Number(user_id)
                )
                .map((m) => ({
                    mapping_id: m.mapping_id,
                    assignment_id: m.assignment.assignment_id,
                    title: m.assignment.title,
                    file: m.assignment.file,
                    unit_ref: m.unit_code,
                    sub_unit_ref: m.sub_unit_id,
                    learnerMap: m.learnerMap,
                    trainerMap: m.trainerMap,
                    uploaded_at: m.assignment.created_at,
                }));

            return res.status(200).json({
                status: true,
                data,
            });
        } catch (error: any) {
            return res.status(500).json({
                status: false,
                message: "Internal Server Error",
                error: error.message,
            });
        }
    }

    public async toggleMappingFlag(req: CustomRequest, res: Response) {
        try {
            const { mapping_id, learnerMap, trainerMap, comment } = req.body;

            if (
                !mapping_id ||
                (learnerMap === undefined &&
                    trainerMap === undefined &&
                    comment === undefined)
            ) {
                return res.status(400).json({
                    status: false,
                    message: "Invalid payload",
                });
            }

            const repo = AppDataSource.getRepository(AssignmentMapping);

            const row = await repo.findOne({
                where: { mapping_id },
            });

            if (!row) {
                return res.status(404).json({
                    status: false,
                    message: "Mapping not found",
                });
            }

            if (learnerMap !== undefined) row.learnerMap = learnerMap;
            if (trainerMap !== undefined) row.trainerMap = trainerMap;

            if (comment !== undefined) {
                row.comment = comment;
                row.comment_updated_by = { user_id: req.user.user_id } as any;
                row.comment_updated_at = new Date();
            }

            const saved = await repo.save(row);

            return res.status(200).json({
                status: true,
                data: saved,
            });
        } catch (e: any) {
            return res.status(500).json({
                status: false,
                error: e.message,
            });
        }
    }

    public async unmapAssignment(req: CustomRequest, res: Response) {
        try {
            const { assignment_id, course_id, unit_code, sub_unit_id } = req.body;

            if (!assignment_id || !course_id || !unit_code) {
                return res.status(400).json({ status: false, message: "Invalid payload" });
            }

            const repo = AppDataSource.getRepository(AssignmentMapping);

            await repo.delete({
                assignment: { assignment_id } as any,
                course: { course_id } as any,
                unit_code,
                sub_unit_id: sub_unit_id ?? null,
            });

            return res.status(200).json({ status: true, message: "Unmapped successfully" });
        } catch (e: any) {
            return res.status(500).json({ status: false, error: e.message });
        }
    }
}

export default AssignmentController;
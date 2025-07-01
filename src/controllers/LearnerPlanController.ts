import { Response } from 'express';
import { CustomRequest } from '../util/Interface/expressInterface';
import { AppDataSource } from '../data-source';
import { LearnerPlan, RepeatFrequency, FileType, SessionFileType, LearnerPlanFeedback } from '../entity/LearnerPlan.entity';
import { Course } from '../entity/Course.entity';
import { UserCourse } from '../entity/UserCourse.entity';
import { SendNotification } from '../util/socket/notification';
import { NotificationType, SocketDomain } from '../util/constants';
import { uploadToS3 } from '../util/aws';

class LearnerPlanController {

    public async createLearnerPlan(req: CustomRequest, res: Response) {
        try {
            const learnerPlanRepository = AppDataSource.getRepository(LearnerPlan);

            const {
                assessor_id,
                learners,
                courses,
                title,
                description,
                location,
                startDate,
                Duration,
                type,
                Attended,
                repeatSession,
                repeat_frequency,
                repeat_every,
                include_holidays,
                include_weekends,
                repeat_end_date,
                upload_session_files,
                file_attachments,
                feedback
            } = req.body;

            // Validate required fields
            if (!assessor_id || !learners || !Array.isArray(learners) || learners.length === 0) {
                return res.status(400).json({
                    message: "Assessor ID and learners are required",
                    status: false
                });
            }

            // Create learner plan
            const learnerPlan = learnerPlanRepository.create({
                assessor_id,
                learners: learners.map((id: number) => ({ learner_id: id })),
                courses: courses ? courses.map((id: number) => ({ course_id: id })) : [],
                title,
                description,
                location,
                startDate,
                Duration,
                type,
                Attended,
                repeatSession: repeatSession || false,
                feedback: feedback || null,
                // Repeat session fields
                repeat_frequency: repeatSession ? repeat_frequency : null,
                repeat_every: repeatSession ? repeat_every : null,
                include_holidays: repeatSession ? include_holidays || false : false,
                include_weekends: repeatSession ? include_weekends || false : false,
                repeat_end_date: repeatSession && repeat_end_date ? new Date(repeat_end_date) : null,
                upload_session_files: repeatSession ? upload_session_files || false : false,
                file_attachments: repeatSession ? file_attachments || [] : []
            });

            const savedLearnerPlan = await learnerPlanRepository.save(learnerPlan);

            // Fetch learner plan with relations for response and notifications
            const learnerPlanWithRelations: any = await learnerPlanRepository.findOne({
                where: { learner_plan_id: savedLearnerPlan.learner_plan_id },
                relations: ['assessor_id', 'learners', 'learners.user_id', 'courses']
            });

            // Send notifications to learners (no email functionality as requested)
            learnerPlanWithRelations?.learners.forEach(async (learner: any) => {
                const learnerId = learner.user_id.user_id;
                const assessorName = learnerPlanWithRelations.assessor_id.first_name + " " + learnerPlanWithRelations.assessor_id.last_name;
                const planDate = new Date(learnerPlanWithRelations.startDate).toISOString().split('T')[0];
                
                console.log(`📤 Sending learner plan notification to learner ID: ${learnerId}`);
                
                const notificationData = {
                    data: {
                        title: "New Learner Plan",
                        message: `You have a new learner plan with ${assessorName} on ${planDate}`,
                        type: NotificationType.Notification
                    },
                    domain: SocketDomain.CourseAllocation
                };
                
                try {
                    await SendNotification(learnerId, notificationData);
                    console.log(`✅ Notification sent successfully to learner ${learnerId}`);
                } catch (error) {
                    console.error(`❌ Failed to send notification to learner ${learnerId}:`, error);
                }
            });

            return res.status(200).json({
                message: "Learner plan created successfully",
                status: true,
                data: {
                    ...savedLearnerPlan,
                    assessor_details: learnerPlanWithRelations.assessor_id,
                    learners: learnerPlanWithRelations.learners,
                    courses: learnerPlanWithRelations.courses
                }
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async getFilteredCourses(assessorId: number, learnerIds: number[]) {
        try {
            console.log(`🔍 Filtering courses for assessor ${assessorId} and learners [${learnerIds.join(', ')}]`);

            if (!assessorId || !learnerIds || learnerIds.length === 0) {
                console.log('⚠️ Invalid parameters for course filtering');
                return [];
            }

            const userCourseRepository = AppDataSource.getRepository(UserCourse);

            // Get courses where the assessor is involved (trainer, IQA, LIQA, EQA) and learners are assigned
            const filteredCourses = await userCourseRepository.createQueryBuilder('uc')
                .leftJoinAndSelect('uc.learner_id', 'learner') // this is OK because it's a relation
                .where('uc.learner_id IN (:...learnerIds)', { learnerIds })
                .andWhere(
                    '(uc.trainer_id = :assessorId OR uc.IQA_id = :assessorId OR uc.LIQA_id = :assessorId OR uc.EQA_id = :assessorId)',
                    { assessorId }
                )
                .select([
                    'uc.user_course_id',
                    'uc.course', // ✅ direct JSON field
                    'learner.learner_id',
                    'learner.first_name',
                    'learner.last_name'
                ])
                .getMany();


            console.log(`✅ Found ${filteredCourses.length} filtered courses`);
            return filteredCourses;
        } catch (error) {
            console.error('❌ Error fetching filtered courses:', error);
            return [];
        }
    }

    public async updateLearnerPlan(req: CustomRequest, res: Response) {
        try {
            const learnerPlanRepository = AppDataSource.getRepository(LearnerPlan);

            const id = parseInt(req.params.id);
            const { title, description, location, startDate, Duration, type, Attended, repeatSession, feedback } = req.body;

            let learnerPlan = await learnerPlanRepository.findOne({ where: { learner_plan_id: id } });
            if (!learnerPlan) {
                return res.status(404).json({
                    message: "Learner plan not found",
                    status: false
                });
            }

            learnerPlan.title = title || learnerPlan.title;
            learnerPlan.description = description || learnerPlan.description;
            learnerPlan.location = location || learnerPlan.location;
            learnerPlan.startDate = startDate || learnerPlan.startDate;
            learnerPlan.Duration = Duration || learnerPlan.Duration;
            learnerPlan.type = type || learnerPlan.type;
            learnerPlan.Attended = Attended || learnerPlan.Attended;
            learnerPlan.repeatSession = repeatSession !== undefined ? repeatSession : learnerPlan.repeatSession;
            learnerPlan.feedback = feedback !== undefined ? feedback : learnerPlan.feedback;

            learnerPlan = await learnerPlanRepository.save(learnerPlan);

            return res.status(200).json({
                message: "Learner plan updated successfully",
                status: true,
                data: learnerPlan
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async deleteLearnerPlan(req: CustomRequest, res: Response) {
        try {
            const id = parseInt(req.params.id);
            const learnerPlanRepository = AppDataSource.getRepository(LearnerPlan);

            const deleteResult = await learnerPlanRepository.delete(id);

            if (deleteResult.affected === 0) {
                return res.status(404).json({
                    message: 'Learner plan not found',
                    status: false,
                });
            }

            return res.status(200).json({
                message: 'Learner plan deleted successfully',
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

    public async getLearnerPlans(req: CustomRequest, res: Response) {
        try {
            const learnerPlanRepository = AppDataSource.getRepository(LearnerPlan);

            const { assessor_id, learners, type, Attended, sortBy } = req.query as any;

            const qb = learnerPlanRepository.createQueryBuilder('learnerPlan')
                .leftJoinAndSelect('learnerPlan.assessor_id', 'assessor')
                .leftJoinAndSelect('learnerPlan.learners', 'learner')
                .leftJoinAndSelect('learnerPlan.courses', 'course')
                .select([
                    'learnerPlan.learner_plan_id',
                    'learnerPlan.title',
                    'learnerPlan.location',
                    'learnerPlan.startDate',
                    'learnerPlan.Duration',
                    'learnerPlan.type',
                    'learnerPlan.Attended',
                    'learnerPlan.description',
                    'learnerPlan.repeatSession',
                    'learnerPlan.feedback',
                    'learnerPlan.repeat_frequency',
                    'learnerPlan.repeat_every',
                    'learnerPlan.include_holidays',
                    'learnerPlan.include_weekends',
                    'learnerPlan.repeat_end_date',
                    'learnerPlan.upload_session_files',
                    'learnerPlan.file_attachments',
                    'learnerPlan.created_at',
                    'learnerPlan.updated_at',
                    'assessor.user_id',
                    'assessor.user_name',
                    'assessor.email',
                    'learner.learner_id',
                    'learner.user_name',
                    'learner.email',
                    'course.course_id',
                    'course.course_name',
                    'course.course_code'
                ]);

            if (assessor_id) {
                qb.andWhere('assessor.user_id = :assessor_id', { assessor_id });
            }
            if (type) {
                qb.andWhere('learnerPlan.type = :type', { type });
            }
            if (Attended) {
                qb.andWhere('learnerPlan.Attended = :Attended', { Attended });
            }
            if (learners) {
                const learnerIds = learners.split(',');
                const learnerPlansWithLearner = await learnerPlanRepository.createQueryBuilder('learnerPlan')
                    .leftJoin('learnerPlan.learners', 'learner')
                    .where('learner.learner_id IN (:...learnerIds)', { learnerIds })
                    .select('learnerPlan.learner_plan_id')
                    .getMany();

                const learnerPlanIds = learnerPlansWithLearner.map(lp => lp.learner_plan_id);
                if (learnerPlanIds.length === 0) {
                    qb.andWhere('1 = 0');
                } else {
                    qb.andWhere('learnerPlan.learner_plan_id IN (:...learnerPlanIds)', { learnerPlanIds });
                }
            }

            // Add sorting for startDate
            const sortOrder = sortBy === 'asc' ? 'ASC' : 'DESC';
            
            qb.skip(req.pagination.skip)
                .take(Number(req.pagination.limit))
                .orderBy('learnerPlan.startDate', sortOrder);

            const [learnerPlans, count] = await qb.getManyAndCount();

            return res.status(200).json({
                message: "Learner plans fetched successfully",
                status: true,
                data: learnerPlans,
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
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async getLearnerPlan(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const learnerPlanRepository = AppDataSource.getRepository(LearnerPlan);
            const { id } = req.params;

            const learnerPlan = await learnerPlanRepository.createQueryBuilder('learnerPlan')
                .leftJoinAndSelect('learnerPlan.assessor_id', 'assessor')
                .leftJoinAndSelect('learnerPlan.learners', 'learner')
                .leftJoinAndSelect('learnerPlan.courses', 'courses')
                .where('learnerPlan.learner_plan_id = :id', { id })
                .select([
                    'learnerPlan.learner_plan_id',
                    'learnerPlan.title',
                    'learnerPlan.description',
                    'learnerPlan.location',
                    'learnerPlan.startDate',
                    'learnerPlan.Duration',
                    'learnerPlan.type',
                    'learnerPlan.Attended',
                    'learnerPlan.repeatSession',
                    'learnerPlan.feedback',
                    'learnerPlan.repeat_frequency',
                    'learnerPlan.repeat_every',
                    'learnerPlan.include_holidays',
                    'learnerPlan.include_weekends',
                    'learnerPlan.repeat_end_date',
                    'learnerPlan.upload_session_files',
                    'learnerPlan.file_attachments',
                    'learnerPlan.created_at',
                    'learnerPlan.updated_at',
                    'assessor.user_id',
                    'assessor.user_name',
                    'assessor.email',
                    'learner.learner_id',
                    'learner.user_name',
                    'learner.email',
                    'courses.course_id',
                    'courses.course_name',
                    'courses.course_code'
                ])
                .getOne();

            if (!learnerPlan) {
                return res.status(404).json({
                    message: "Learner plan not found",
                    status: false
                });
            }

            return res.status(200).json({
                message: "Learner plan fetched successfully",
                status: true,
                data: learnerPlan
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async getLearnerPlansByMonth(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const learnerPlanRepository = AppDataSource.getRepository(LearnerPlan);
            const { year, month, learner_id, assessor_id } = req.query;

            if (!year || !month) {
                return res.status(400).json({
                    message: "Year and month are required",
                    status: false
                });
            }

            const startDate = new Date(Number(year), Number(month) - 1, 1);
            const endDate = new Date(Number(year), Number(month), 0);

            const qb = learnerPlanRepository.createQueryBuilder('learnerPlan')
                .leftJoinAndSelect('learnerPlan.assessor_id', 'assessor')
                .leftJoinAndSelect('learnerPlan.learners', 'learner')
                .leftJoinAndSelect('learnerPlan.courses', 'course')
                .where('learnerPlan.startDate BETWEEN :startDate AND :endDate', { startDate, endDate });

            if (assessor_id) {
                qb.andWhere('assessor.user_id = :assessor_id', { assessor_id });
            }

            if (learner_id) {
                qb.andWhere('learner.learner_id = :learner_id', { learner_id });
            }

            const learnerPlans = await qb
                .orderBy('learnerPlan.startDate', 'ASC')
                .getMany();

            return res.status(200).json({
                message: "Learner plans fetched successfully",
                status: true,
                data: learnerPlans
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async testLearnerPlanNotification(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const { learner_id } = req.body;

            if (!learner_id) {
                return res.status(400).json({
                    message: "Learner ID is required",
                    status: false
                });
            }

            // Test learner plan data with future date
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 7); // 7 days from now

            const testNotificationData = {
                data: {
                    title: "Test Learner Plan Notification",
                    message: `You have a test learner plan scheduled for ${futureDate.toISOString().split('T')[0]}`,
                    type: NotificationType.Notification
                },
                domain: SocketDomain.CourseAllocation
            };

            console.log('📧 Sending test learner plan notification...');

            try {
                await SendNotification(learner_id, testNotificationData);
                console.log(`✅ Test notification sent successfully to learner ${learner_id}`);

                return res.status(200).json({
                    message: "Test learner plan notification sent successfully",
                    status: true,
                    data: {
                        learner_id,
                        notification_data: testNotificationData
                    }
                });
            } catch (error) {
                console.error(`❌ Failed to send test notification to learner ${learner_id}:`, error);
                return res.status(500).json({
                    message: "Failed to send test notification",
                    status: false,
                    error: error.message
                });
            }

        } catch (error) {
            console.error('❌ Error in testLearnerPlanNotification:', error);
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async testCourseFiltering(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const { assessor_id, learner_ids } = req.body;

            if (!assessor_id || !learner_ids || !Array.isArray(learner_ids)) {
                return res.status(400).json({
                    message: "assessor_id and learner_ids array are required",
                    status: false
                });
            }

            console.log(`🧪 Testing course filtering with assessor_id: ${assessor_id}, learner_ids: [${learner_ids.join(', ')}]`);

            const filteredCourses = await this.getFilteredCourses(assessor_id, learner_ids);

            return res.status(200).json({
                message: "Course filtering test completed successfully",
                status: true,
                data: {
                    assessor_id,
                    learner_ids,
                    filtered_courses: filteredCourses,
                    total_courses_found: filteredCourses.length
                }
            });

        } catch (error) {
            console.error('❌ Error in testCourseFiltering:', error);
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async getCourseListByAssessorAndLearner(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const { trainer_id, learner_id } = req.query;

            if (!trainer_id) {
                return res.status(400).json({
                    message: "trainer_id is required",
                    status: false
                });
            }

            if (!learner_id) {
                return res.status(400).json({
                    message: "learner_id is required",
                    status: false
                });
            }

            const userCourseRepository = AppDataSource.getRepository(UserCourse);

            // Simple query to get courses where trainer and learner are connected
            const courses = await userCourseRepository.createQueryBuilder('uc')
                .where('uc.trainer_id = :trainer_id', { trainer_id: parseInt(trainer_id as string) })
                .andWhere('uc.learner_id = :learner_id', { learner_id: parseInt(learner_id as string) })
                .getMany();

            // Extract simple course list with id and name
            const courseList = courses.map(uc => {
                const courseData = uc.course as any;
                return {
                    course_id: courseData?.course_id || null,
                    course_name: courseData?.course_name || null,
                    course_code: courseData?.course_code || null
                };
            }).filter(course => course.course_id !== null);

            // Remove duplicates based on course_id
            const uniqueCourses = courseList.filter((course, index, self) =>
                index === self.findIndex(c => c.course_id === course.course_id)
            );

            return res.status(200).json({
                message: "Course list retrieved successfully",
                status: true,
                data: {
                    trainer_id: parseInt(trainer_id as string),
                    learner_id: parseInt(learner_id as string),
                    total_courses: uniqueCourses.length,
                    courses: uniqueCourses
                }
            });

        } catch (error) {
            console.error('❌ Error in getCourseListByAssessorAndLearner:', error);
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async uploadLearnerPlanFiles(req: CustomRequest, res: Response) {
        try {
            const { assessor_id, file_type, session_type, session_scope } = req.body;

            if (!req.file) {
                return res.status(400).json({
                    message: "No file uploaded",
                    status: false
                });
            }

            if (!assessor_id) {
                return res.status(400).json({
                    message: "Assessor ID is required",
                    status: false
                });
            }

            // Upload file to S3
            const s3Upload = await uploadToS3(req.file, "LearnerPlan");

            // Create file attachment object for pre-upload with S3 data
            const fileAttachment = {
                assessor_id: parseInt(assessor_id),
                file_type: file_type as FileType,
                session_type: session_type as SessionFileType,
                session_scope: session_scope || 'first_session',
                file_name: req.file.originalname,
                file_size: req.file.size,
                file_url: s3Upload.url,
                s3_key: s3Upload.key,
                uploaded_at: new Date(),
                temp_upload_id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
            };

            return res.status(200).json({
                message: "File pre-uploaded successfully to S3",
                status: true,
                data: {
                    uploaded_file: fileAttachment,
                    temp_upload_id: fileAttachment.temp_upload_id,
                    s3_url: s3Upload.url,
                    s3_key: s3Upload.key
                }
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async getRepeatSessionOptions(_req: CustomRequest, res: Response) {
        try {
            const options = {
                frequencies: Object.values(RepeatFrequency),
                file_types: Object.values(FileType),
                session_types: Object.values(SessionFileType),
                session_scopes: [
                    { value: 'first_session', label: 'First Session' },
                    { value: 'all_sessions', label: 'All Sessions' }
                ],
                feedback_options: Object.values(LearnerPlanFeedback)
            };

            return res.status(200).json({
                message: "Repeat session options fetched successfully",
                status: true,
                data: options
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async cancelRepeatLearnerPlan(req: CustomRequest, res: Response) {
        try {
            const learnerPlanRepository = AppDataSource.getRepository(LearnerPlan);
            const { id } = req.params;

            const learnerPlan = await learnerPlanRepository.findOne({
                where: { learner_plan_id: parseInt(id) }
            });

            if (!learnerPlan) {
                return res.status(404).json({
                    message: "Learner plan not found",
                    status: false
                });
            }

            // Simply disable repeat session
            learnerPlan.repeatSession = false;
            learnerPlan.repeat_frequency = null;
            learnerPlan.repeat_every = null;
            learnerPlan.repeat_end_date = null;

            await learnerPlanRepository.save(learnerPlan);

            return res.status(200).json({
                message: "Repeat learner plan cancelled successfully",
                status: true,
                data: learnerPlan
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }
}

export default LearnerPlanController;

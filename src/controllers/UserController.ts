import { Request, Response } from "express";
import { User } from "../entity/User.entity";
import { AppDataSource } from "../data-source";
import { bcryptpassword, comparepassword, generatePassword } from "../util/bcrypt";
import { generateToken } from "../util/JwtAuth";
import { Learner } from "../entity/Learner.entity";
import { Equal, IsNull } from "typeorm";
import { deleteFromS3, uploadToS3 } from "../util/aws";
import { CustomRequest } from "../util/Interface/expressInterface";
import { resetPasswordByEmail, sendPasswordByEmail, sendUserEmail } from "../util/mailSend";
import { getHighestPriorityRole, UserRole } from "../util/constants";
import { UserCourse } from "../entity/UserCourse.entity";

class UserController {

    public async CreateUser(req: CustomRequest, res: Response) {
        try {
            const { user_name, first_name, last_name, email, password, confrimpassword, roles } = req.body
            if (!user_name || !first_name || !last_name || !email || !password || !roles || !confrimpassword) {
                return res.status(400).json({
                    message: "All Field Required",
                    status: false
                })
            }
            const userRepository = AppDataSource.getRepository(User)

            const userEmail = await userRepository.findOne({ where: { email: email } });

            if (userEmail) {
                return res.status(409).json({
                    message: "Email already exist",
                    status: false
                })
            }

            if (password !== confrimpassword) {
                return res.status(400).json({
                    message: "Password and confrim password not match",
                    status: false
                })
            }
            if (roles.includes(UserRole.Admin)) {
                req.body.password_changed = true
            }

            req.body.password = await bcryptpassword(req.body.password)
            const user = await userRepository.create(req.body);

            const users: any = await userRepository.save(user)
            res.status(200).json({
                message: "User create successfully",
                status: true,
                data: users
            })

            sendPasswordByEmail(users.email, req.body.confrimpassword)

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            })
        }
    }

    public async GetUser(req: CustomRequest, res: Response) {
        try {
            const userRepository = AppDataSource.getRepository(User)
            const id: number = parseInt(req.user.user_id);

            const user = await userRepository.findOne({ where: { user_id: id }, relations: ["employer_id"] });

            delete user.password;

            if (!user) {
                return res.status(404).json({
                    message: "User does not exist",
                    status: false
                });
            }

            return res.status(200).json({
                message: "User fetched successfully",
                status: false,
                data: user
            })

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            })
        }
    }

    public async UpdateUser(req: any, res: Response) {
        try {
            const { user_name, first_name, last_name, sso_id, mobile, phone, roles, time_zone, email, status } = req.body;
            const userId: number = parseInt(req.params.id);

            if (!user_name && !first_name && !last_name && !sso_id && !mobile && !phone && !roles && !time_zone && !email && !status) {
                return res.status(400).json({
                    message: "At least one field required",
                    status: false
                });
            }

            if (req.tokenrole !== UserRole.Admin && (Boolean(roles?.length) || Boolean(email) || Boolean(mobile) || Boolean(sso_id))) {
                return res.status(401).json({
                    message: "Admin role is required",
                    status: false
                })
            }


            const userRepository = AppDataSource.getRepository(User)

            const user = await userRepository.findOne({
                where: { user_id: userId },
            });

            if (!user) {
                return res.status(404).json({
                    message: "User does not exist",
                    status: false
                })
            }

            if (user.email !== email) {
                const user = await userRepository.findOne({
                    where: { email },
                });

                if (user) {
                    return res.status(404).json({
                        message: "email already exists",
                        status: false
                    })
                }
            }
            for (const key in req.body) {
                (user as any)[key] = req.body[key];
            }

            const updatedUser = await userRepository.save(user)

            return res.status(200).json({
                message: "User updated successfully",
                status: true,
                data: updatedUser
            })

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            })
        }
    }

    public async LoginUser(req: Request, res: Response) {
        try {
            const userRepository = AppDataSource.getRepository(User)
            const learnerRepository = AppDataSource.getRepository(Learner)

            const { email, password } = req.body
            if (!email || !password) {
                return res.status(400).json({
                    message: "Email and password field required",
                    status: false
                })
            }

            let user: any = await userRepository.findOne({
                where: { email: email },
            });

            if (!user) {
                return res.status(404).json({
                    message: "Invalid credentials, please try again.",
                    status: false
                })
            }

            const hashedPassword = await comparepassword(password, user.password)

            if (hashedPassword !== true) {
                return res.status(402).json({
                    message: "Invalid credentials, please try again.",
                    status: true
                })
            }
            delete user.password;
            delete user.created_at;
            delete user.updated_at;
            delete user.deleted_at;

            const learner = await learnerRepository.findOne({ where: { user_id: user.user_id } })
            if (learner) {
                user.learner_id = learner.learner_id
                learner.last_login = new Date();
                learnerRepository.save(learner);
            }

            const role = getHighestPriorityRole(user.roles)

            let accessToken = generateToken({
                ...user,
                displayName: user.first_name + " " + user.last_name,
                role
            })

            let responce = {
                password_changed: user.password_changed,
                accessToken: accessToken,
                user: { ...user, role }
            }
            return res.status(200).json({
                data: responce,
                message: "Login successful",
                status: true
            })

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false
            })
        }
    }

    public async UpdatePassword(req: Request, res: Response) {
        try {
            const userRepository = AppDataSource.getRepository(User)

            const { email, password } = req.body
            if (!email || !password) {
                return res.status(400).json({
                    message: "Email and password field required",
                    status: false
                })
            }

            const user = await userRepository.findOne({
                where: { email: email },
            });

            if (!user) {
                return res.status(404).json({
                    message: "User does not exist",
                    status: false
                })
            }

            const hashedPassword = await bcryptpassword(req.body.password)
            user.password = hashedPassword;
            if (!user.password_changed) {
                user.password_changed = true;
            }

            await userRepository.save(user)

            return res.status(200).json({
                message: "Password changed successfully",
                status: true
            })

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false
            })
        }
    }

    public async ChangePassword(req: CustomRequest, res: Response) {
        try {
            const userRepository = AppDataSource.getRepository(User)

            const { currentPassword, newPassword, confirmPassword, user_id } = req.body
            if (!currentPassword || !newPassword || !confirmPassword || !user_id) {
                return res.status(400).json({
                    message: "All field required",
                    status: false
                })
            }

            if (newPassword !== confirmPassword) {
                return res.status(400).json({
                    message: "New password and Confirm Password must be the same",
                    status: false
                })
            }

            const user = await userRepository.findOne({ where: { user_id } });

            if (!user) {
                return res.status(404).json({
                    message: "User does not exist",
                    status: false
                })
            }
            const compated = await comparepassword(currentPassword, user.password)
            if (!compated) {
                return res.status(400).json({
                    message: "Current password is incorrect",
                    status: false
                })
            }
            const hashedPassword = await bcryptpassword(newPassword)
            user.password = hashedPassword;
            if (!user.password_changed) {
                user.password_changed = true;
            }

            await userRepository.save(user)

            return res.status(200).json({
                message: "Password changed successfully",
                status: true
            })

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false
            })
        }
    }

    public async mailPassword(req: CustomRequest, res: Response) {
        try {
            const userRepository = AppDataSource.getRepository(User)

            const { email } = req.body
            if (!email) {
                return res.status(400).json({
                    message: "Email field required",
                    status: false
                })
            }

            const user = await userRepository.findOne({ where: { email } });
            if (!user) {
                return res.status(404).json({
                    message: "User does not exist",
                    status: false
                })
            }

            const role = getHighestPriorityRole(user.roles)

            let accessToken = generateToken({
                ...user,
                displayName: user.first_name + " " + user.last_name,
                role
            }, '24h')
            await resetPasswordByEmail(email, `${process.env.FRONTEND}/reset-password?token=${accessToken}`)

            return res.status(200).json({
                message: "Password reset main send successfully",
                status: true
            })

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false
            })
        }
    }

    public async DeleteUser(req: CustomRequest, res: Response) {
        try {
            const userRepository = AppDataSource.getRepository(User);
            const learnerRepository = AppDataSource.getRepository(Learner);

            const id: number = parseInt(req.params.id);

            const user = await userRepository.findOne({ where: { user_id: id } });

            if (!user) {
                return res.status(404).json({
                    message: "User does not exist",
                    status: false
                });
            }
            // if (user.role === UserRole.Admin) {
            //     return res.status(403).json({
            //         message: "Deleting admin account is restricted",
            //         status: false
            //     })
            // }
            // if (user?.avatar) {
            //     deleteFromS3(user.avatar)
            // }

            const learners = await learnerRepository.findOneBy({ user_id: Equal(id) });
            if (learners) {
                await learnerRepository.softDelete(learners.learner_id);
            }

            await userRepository.softDelete(id);

            return res.status(200).json({
                message: "User deleted successfully",
                status: true
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false
            });
        }
    }

    public async GetUserList(req: any, res: Response) {
        try {
            const userRepository = AppDataSource.getRepository(User)
            const qb = userRepository.createQueryBuilder("user");

            if (req.query.role) {
                qb.andWhere(":role = ANY(user.roles)", { role: req.query.role });
                if (req.query.keyword) {
                    qb.andWhere("(user.email ILIKE :keyword OR user.user_name ILIKE :keyword OR user.first_name ILIKE :keyword OR user.last_name ILIKE :keyword)", { keyword: `%${req.query.keyword}%` });
                }
                if (req.query.role === UserRole.Employer) {
                    qb.leftJoinAndSelect('user.employer', 'employer')
                }
            } else if (req.query.keyword) {
                qb.andWhere("((user.email ILIKE :keyword OR user.user_name ILIKE :keyword OR user.first_name ILIKE :keyword OR user.last_name ILIKE :keyword) AND (ARRAY_LENGTH(user.roles, 1) != 1 OR 'Learner' <> ANY(user.roles)))", { keyword: `%${req.query.keyword}%` });
            }
            else {
                qb.andWhere("ARRAY_LENGTH(user.roles, 1) != 1 OR 'Learner' <> ANY(user.roles)")
            }

            if (req.query.meta === "true") {
                qb
                    .skip(Number(req.pagination.skip))
                    .take(Number(req.pagination.limit))
            }

            const [users, count] = await qb
                .orderBy("user.user_id", "ASC")
                .getManyAndCount();

            return res.status(200).json({
                message: "Users fetched successfully",
                status: false,
                data: users,
                ...(req.query.meta === "true" && {
                    meta_data: {
                        page: req.pagination.page,
                        items: count,
                        page_size: req.pagination.limit,
                        pages: Math.ceil(count / req.pagination.limit)
                    }
                })
            })


        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            })
        }
    }

    public async UploadAvatar(req: any, res: Response) {
        try {
            let userId: number = parseInt(req.user.user_id);

            if (req.body.user_id) {
                userId = req.body.user_id
            }

            if (!req.file) {
                return res.status(400).json({
                    message: "Avatar Field Required ",
                    status: false
                });
            }

            const userRepository = AppDataSource.getRepository(User)

            const user = await userRepository.findOne({
                where: { user_id: userId },
            });

            if (!user) {
                return res.status(404).json({
                    message: "User does not exist",
                    status: false
                })
            }

            if (user.avatar) {
                deleteFromS3(user.avatar)
            }
            user.avatar = await uploadToS3(req.file, "avatar")

            await userRepository.save(user)
            let accessToken = generateToken({ ...user, displayName: user.first_name + " " + user.last_name, role: req.body.role })

            return res.status(200).json({
                message: "Avatar uploaded successfully",
                status: true,
                data: accessToken,
                avatar: user.avatar
            })

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            })
        }
    }

    public async ChangeUserRole(req: any, res: Response) {
        try {
            const user_id: number = parseInt(req.user.user_id);
            const { role } = req.body

            const userRepository = AppDataSource.getRepository(User)
            const learnerRepository = AppDataSource.getRepository(Learner)
            let user: any = await userRepository.findOne({ where: { user_id } });

            if (!user.roles.includes(role)) {
                return res.status(404).json({
                    message: "You are not allowed to change this user role",
                    status: false,
                })
            }

            if (role === UserRole.Learner) {
                const learner = await learnerRepository.findOne({ where: { user_id: { user_id: user.user_id } } })
                if (learner) {
                    user.learner_id = learner.learner_id
                }
            }

            let accessToken = generateToken({ ...user, displayName: user.first_name + " " + user.last_name, role })

            return res.status(200).json({
                message: "Your role has been changed successfully",
                status: true,
                data: {
                    accessToken: accessToken,
                    user: { ...user, role }
                }
            })

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            })
        }
    }
    public async getUserListForEQA(req: any, res: Response) {
        try {
            const { EQA_id, user } = req.query as any;

            const userCourseRepository = AppDataSource.getRepository(UserCourse)
            let userCourse = await userCourseRepository.find({ where: { EQA_id: { user_id: EQA_id } }, relations: [user], order: { created_at: "ASC" } });

            const uniqueLearnersMap = new Map();
            userCourse.forEach(course => {
                if (user === "learner_id") {
                    uniqueLearnersMap.set(course?.learner_id?.learner_id, course.learner_id);
                } else {
                    uniqueLearnersMap.set(course[user]?.user_id, course[user]);
                }

            });
            let users = Array.from(uniqueLearnersMap.values());
            const { page, limit } = req.pagination;
            return res.status(200).json({
                message: "user data fetched successfully",
                status: true,
                data: users.slice((page - 1) * limit, page * limit),
                ...(req.query.meta === "true" && {
                    meta_data: {
                        page: page,
                        items: users.length,
                        page_size: limit,
                        pages: Math.ceil(users.length / limit)
                    }
                })
            })

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            })
        }
    }

    public async getToken(req: Request, res: Response) {
        try {
            const userRepository = AppDataSource.getRepository(User)
            const learnerRepository = AppDataSource.getRepository(Learner)

            const { email } = req.body

            let user: any = await userRepository.findOne({
                where: { email: email },
            });

            if (!user) {
                return res.status(404).json({
                    message: "User not found",
                    status: false
                })
            }

            delete user.password;
            delete user.created_at;
            delete user.updated_at;
            delete user.deleted_at;

            const learner = await learnerRepository.findOne({ where: { user_id: user.user_id } })
            if (learner) {
                user.learner_id = learner.learner_id
            }

            const role = getHighestPriorityRole(user.roles)

            let accessToken = generateToken({
                ...user,
                displayName: user.first_name + " " + user.last_name,
                role
            })

            let responce = {
                password_changed: user.password_changed,
                accessToken: accessToken,
                user: { ...user, role }
            }
            return res.status(200).json({
                data: responce,
                message: "Token get successful",
                status: true
            })

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false
            })
        }
    }

    public async sendMail(req: Request, res: Response) {
        try {
            const { email, subject, message, adminName } = req.body
            if (!email || !subject || !message || !adminName) {
                return res.status(400).json({
                    message: "All field required",
                    status: false
                })
            }

            const sendmail = await sendUserEmail(email, { subject, message, adminName })

            if (!sendmail) {

                return res.status(532).json({
                    message: "Failed to send email",
                    status: false
                })
            }

            return res.status(200).json({
                message: "Mail send successfully",
                status: true
            })

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false
            })
        }
    }
}

export default UserController;
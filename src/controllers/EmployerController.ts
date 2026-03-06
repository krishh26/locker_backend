import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Learner } from "../entity/Learner.entity";
import { User } from "../entity/User.entity";
import { bcryptpassword, generatePassword } from "../util/bcrypt";
import { sendPasswordByEmail } from "../util/mailSend";
import { CustomRequest } from "../util/Interface/expressInterface";
import { Employer } from "../entity/Employer.entity";
import { UserRole } from "../util/constants";
import { applyEmployerScope, applyLearnerScope, canAccessOrganisation, canAccessCentre, getScopeContext, validateCentreOrganisation } from "../util/organisationFilter";


class EmployerController {

    public async createEmployer(req: CustomRequest, res: Response) {
        try {
            const {
                employer_name,
                msi_employer_id,
                business_department,
                business_location,
                branch_code,
                address_1,
                address_2,
                city,
                country,
                employer_county,
                postal_code,
                business_category,
                number,
                telephone,
                website,
                key_contact_name,
                key_contact_number,
                business_description,
                comments,
                email,
                assessment_date,
                assessment_renewal_date,
                insurance_renewal_date,
                file,
                organisation_id,
                centre_id
            } = req.body
            if (!employer_name ||
                !msi_employer_id ||
                !address_1 ||
                !address_2 ||
                !city ||
                !country ||
                !postal_code ||
                !email) {
                return res.status(400).json({
                    message: "All Field Required",
                    status: false
                })
            }
            if (!organisation_id) {
                return res.status(400).json({
                    message: "organisation_id is required",
                    status: false
                })
            }
            if (!centre_id) {
                return res.status(400).json({
                    message: "centre_id is required",
                    status: false
                })
            }
            if (req.user && !(await canAccessOrganisation(req.user, organisation_id, getScopeContext(req)))) {
                return res.status(403).json({
                    message: "You do not have access to create employers in this organisation",
                    status: false
                })
            }
            const centreBelongsToOrg = await validateCentreOrganisation(Number(centre_id), Number(organisation_id));
            if (!centreBelongsToOrg) {
                return res.status(403).json({
                    message: "Centre does not belong to the specified organisation",
                    status: false
                })
            }
            if (req.user && !(await canAccessCentre(req.user, Number(centre_id), getScopeContext(req)))) {
                return res.status(403).json({
                    message: "You do not have access to this centre",
                    status: false
                })
            }
            const userRepository = AppDataSource.getRepository(User)
            const employerRepository = AppDataSource.getRepository(Employer)

            const userEmail = await userRepository.findOne({ where: { email: email } });

            if (userEmail) {
                return res.status(409).json({
                    message: "Email already exist",
                    status: false
                })
            }

            const password = generatePassword()
            req.body.password = await bcryptpassword(password)

            let employer = await employerRepository.save(employerRepository.create({
                employer_name,
                msi_employer_id,
                organisation_id: Number(organisation_id),
                centre_id: Number(centre_id),
                business_department,
                business_location,
                branch_code,
                address_1,
                address_2,
                city,
                country,
                employer_county,
                postal_code,
                business_category,
                telephone,
                website,
                key_contact_name,
                key_contact_number,
                business_description,
                comments,
                assessment_date,
                assessment_renewal_date,
                insurance_renewal_date,
                file
            }));

            let user = userRepository.create({
                email,
                password: req.body.password,
                mobile: number,
                roles: [UserRole.Employer],
                employer: employer
            });

            user = await userRepository.save(user);

            employer.user = user;
            employer = await employerRepository.save(employer);


            const sendResult = await sendPasswordByEmail(email, password)
            if (!sendResult) {
                return res.status(500).json({
                    message: "Failed to send the email",
                    status: false,
                });
            }

            return res.status(200).json({
                message: "Employer create successfully",
                status: true,
                data: user
            })

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                error: error.message,
                status: false
            })
        }
    }

    public async getEmployerList(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const employerRepository = AppDataSource.getRepository(Employer);

            const qb = employerRepository.createQueryBuilder("employer")
                .leftJoinAndSelect("employer.user", "user")
                .select([
                    "employer.employer_id",
                    "employer.employer_name",
                    "employer.msi_employer_id",
                    "employer.business_department",
                    "employer.business_location",
                    "employer.branch_code",
                    "employer.address_1",
                    "employer.address_2",
                    "employer.city",
                    "employer.country",
                    "employer.postal_code",
                    "employer.business_category",
                    "employer.telephone",
                    "employer.website",
                    "employer.key_contact_name",
                    "employer.key_contact_number",
                    "employer.business_description",
                    "employer.comments",
                    "employer.assessment_date",
                    "employer.assessment_renewal_date",
                    "employer.insurance_renewal_date",
                    "employer.employer_county",
                    "employer.health_safety_renewal_date",
                    "employer.employer_postcode",
                    "employer.employer_town_city",
                    "employer.employer_telephone",
                    "employer.file",
                    "employer.deleted_at",
                    "employer.created_at",
                    "employer.updated_at",
                    "employer.organisation_id",
                    "employer.centre_id",
                    "user.email",
                    "user.mobile"
                ])

            if (req.query.keyword) {
                qb.andWhere("(user.email ILIKE :keyword OR employer.employer_name ILIKE :keyword)", { keyword: `%${req.query.keyword}%` });
            }

            if (req.user) {
                await applyEmployerScope(qb, req.user, "employer", { scopeContext: getScopeContext(req) });
            }

            const [employer, count] = await qb
                .skip(Number(req.pagination.skip))
                .take(Number(req.pagination.limit))
                .orderBy("employer.created_at", "ASC")
                .getManyAndCount();

            // Get learner counts for each employer (scoped so CentreAdmin only counts learners in their centres)
            const learnerRepository = AppDataSource.getRepository(Learner);
            const employerData = await Promise.all(employer.map(async (emp) => {
                const qb = learnerRepository
                    .createQueryBuilder("learner")
                    .where("learner.employer_id = :id", { id: emp.employer_id });
                if (req.user) await applyLearnerScope(qb, req.user, "learner", { scopeContext: getScopeContext(req) });
                const learnerCount = await qb.getCount();

                return {
                    ...emp,
                    email: emp.user?.email,
                    number: emp.user?.mobile,
                    number_of_learners: learnerCount
                };
            }));

            return res.status(200).json({
                message: "Employer fetched successfully",
                status: true,
                data: employerData,
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
                message: 'Internal Server Error',
                error: error.message,
                status: false,
            });
        }
    }

    public async createMultipleEmployers(req: CustomRequest, res: Response) {
        try {
            const { employers } = req.body;

            if (!employers || !Array.isArray(employers) || employers.length === 0) {
                return res.status(400).json({
                    message: "Employers array is required and must contain at least one employer",
                    status: false
                });
            }

            const userRepository = AppDataSource.getRepository(User);
            const employerRepository = AppDataSource.getRepository(Employer);

            const results: any[] = [];
            const errors: any[] = [];

            for (let i = 0; i < employers.length; i++) {
                const employerData = employers[i];
                const {
                    employer_name,
                    msi_employer_id,
                    business_department,
                    business_location,
                    branch_code,
                    address_1,
                    address_2,
                    city,
                    country,
                    employer_county,
                    postal_code,
                    business_category,
                    number,
                    telephone,
                    website,
                    key_contact_name,
                    key_contact_number,
                    business_description,
                    comments,
                    email,
                    assessment_date,
                    assessment_renewal_date,
                    insurance_renewal_date,
                    organisation_id,
                    centre_id
                } = employerData;

                try {
                    // Validate required fields (all from createEmployer except file)
                    if (!employer_name || !msi_employer_id || !address_1 || !address_2 || !city || !country || !postal_code || !email) {
                        errors.push({ index: i, email: email || 'unknown', error: "Missing required fields" });
                        continue;
                    }
                    if (!organisation_id) {
                        errors.push({ index: i, email: email || 'unknown', error: "organisation_id is required" });
                        continue;
                    }
                    if (!centre_id) {
                        errors.push({ index: i, email: email || 'unknown', error: "centre_id is required" });
                        continue;
                    }
                    if (req.user && !(await canAccessOrganisation(req.user, organisation_id, getScopeContext(req)))) {
                        errors.push({ index: i, email: email || 'unknown', error: "No access to this organisation" });
                        continue;
                    }
                    if (!(await validateCentreOrganisation(Number(centre_id), Number(organisation_id)))) {
                        errors.push({ index: i, email: email || 'unknown', error: "Centre does not belong to the specified organisation" });
                        continue;
                    }
                    if (req.user && !(await canAccessCentre(req.user, Number(centre_id), getScopeContext(req)))) {
                        errors.push({ index: i, email: email || 'unknown', error: "No access to this centre" });
                        continue;
                    }

                    // Check existing email
                    const existing = await userRepository.findOne({ where: { email } });
                    if (existing) {
                        errors.push({ index: i, email, error: "Email already exists" });
                        continue;
                    }

                    // Generate password and hash
                    const plainPassword = generatePassword();
                    const hashedPassword = await bcryptpassword(plainPassword);

                    // Create employer
                    let employer = await employerRepository.save(
                        employerRepository.create({
                            employer_name,
                            msi_employer_id,
                            organisation_id: Number(organisation_id),
                            centre_id: Number(centre_id),
                            business_department,
                            business_location,
                            branch_code,
                            address_1,
                            address_2,
                            city,
                            country,
                            employer_county,
                            postal_code,
                            business_category,
                            telephone,
                            website,
                            key_contact_name,
                            key_contact_number,
                            business_description,
                            comments,
                            assessment_date,
                            assessment_renewal_date,
                            insurance_renewal_date
                        })
                    );

                    // Create user and link
                    let user = userRepository.create({
                        email,
                        password: hashedPassword,
                        mobile: number,
                        roles: [UserRole.Employer],
                        employer: employer
                    });
                    user = await userRepository.save(user);

                    employer.user = user;
                    employer = await employerRepository.save(employer);

                    const sent = await sendPasswordByEmail(email, plainPassword);
                    if (!sent) {
                        errors.push({ index: i, email, error: "Employer created but failed to send email", employer_id: employer.employer_id, user_id: user.user_id });
                    }

                    results.push({ index: i, status: 'success', email, employer_id: employer.employer_id, user_id: user.user_id });

                } catch (e: any) {
                    errors.push({ index: i, email: email || 'unknown', error: e.message });
                }
            }

            return res.status(results.length > 0 ? 200 : 400).json({
                message: `Processed ${employers.length} employer(s): ${results.length} successful, ${errors.length} failed`,
                status: results.length > 0,
                data: {
                    total_processed: employers.length,
                    successful: results.length,
                    failed: errors.length,
                    results,
                    errors
                }
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                error: (error as any).message,
                status: false
            });
        }
    }
    public async updateEmployer(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const employerId: number = parseInt(req.params.id);

            const employerRepository = AppDataSource.getRepository(Employer);
            const userRepository = AppDataSource.getRepository(User);

            const qb = employerRepository.createQueryBuilder('employer')
                .leftJoinAndSelect('employer.user', 'user')
                .where('employer.employer_id = :employerId', { employerId });
            if (req.user) {
                await applyEmployerScope(qb, req.user, 'employer', { scopeContext: getScopeContext(req) });
            }
            const existingEmployer = await qb.getOne();

            if (!existingEmployer) {
                return res.status(403).json({
                    message: 'Employer not found or you do not have access',
                    status: false,
                });
            }

            const bodyOrgId = req.body.organisation_id != null ? Number(req.body.organisation_id) : undefined;
            const bodyCentreId = req.body.centre_id != null ? Number(req.body.centre_id) : undefined;
            if (bodyOrgId !== undefined && bodyOrgId !== existingEmployer.organisation_id) {
                return res.status(403).json({
                    message: 'Cannot assign employer to a different organisation',
                    status: false,
                });
            }
            if (bodyCentreId !== undefined) {
                const orgId = bodyOrgId ?? existingEmployer.organisation_id;
                if (!(await validateCentreOrganisation(bodyCentreId, orgId))) {
                    return res.status(403).json({
                        message: 'Centre does not belong to the employer organisation',
                        status: false,
                    });
                }
                if (req.user && !(await canAccessCentre(req.user, bodyCentreId, getScopeContext(req)))) {
                    return res.status(403).json({
                        message: 'You do not have access to this centre',
                        status: false,
                    });
                }
            }

            if (existingEmployer.user.email !== req.body.email) {
                const user = await userRepository.findOne({
                    where: { email: req.body.email },
                    relations: ['employer'],
                });

                if (user) {
                    return res.status(400).json({
                        message: "Email already exists",
                        status: false
                    })
                } else {
                    existingEmployer.user.email = req.body.email;
                    await userRepository.save(existingEmployer.user);
                }
            }

            employerRepository.merge(existingEmployer, req.body);
            const updatedEmployer = await employerRepository.save(existingEmployer);

            return res.status(200).json({
                message: 'Employer updated successfully',
                status: true,
                data: updatedEmployer,
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                error: error.message,
                status: false,
            });
        }
    }

    public async deleteEmployer(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const employerId: number = parseInt(req.params.id);

            const employerRepository = AppDataSource.getRepository(Employer);
            const userRepository = AppDataSource.getRepository(User);

            const qb = employerRepository.createQueryBuilder('employer')
                .leftJoinAndSelect('employer.user', 'user')
                .where('employer.employer_id = :employerId', { employerId });
            if (req.user) {
                await applyEmployerScope(qb, req.user, 'employer', { scopeContext: getScopeContext(req) });
            }
            const employer = await qb.getOne();

            if (!employer) {
                return res.status(403).json({
                    message: 'Employer not found or you do not have access',
                    status: false,
                });
            }

            await userRepository.softDelete(employer.user.user_id);
            await employerRepository.softDelete(employer.employer_id);

            return res.status(200).json({
                message: 'Employer deleted successfully',
                status: true,
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

export default EmployerController;
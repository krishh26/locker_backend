import { In } from 'typeorm';
import { AppDataSource } from '../data-source';
import { OrganisationCourseExclusion } from '../entity/OrganisationCourseExclusion.entity';

export async function getOrganisationCourseExclusionMap(
    organisation_id: number,
    courseIds: number[]
): Promise<Map<number, boolean>> {
    if (!organisation_id || !courseIds.length) {
        return new Map<number, boolean>();
    }

    const repo = AppDataSource.getRepository(OrganisationCourseExclusion);
    const exclusions = await repo.find({
        where: {
            organisation_id,
            course_id: In(courseIds),
        },
    });

    return new Map(exclusions.map((item) => [item.course_id, item.is_excluded]));
}

export async function getOrganisationCourseExclusion(
    organisation_id: number,
    course_id: number
): Promise<boolean> {
    if (!organisation_id || !course_id) {
        return false;
    }

    const repo = AppDataSource.getRepository(OrganisationCourseExclusion);
    const exclusion = await repo.findOne({
        where: {
            organisation_id,
            course_id,
        },
    });

    return exclusion?.is_excluded ?? false;
}

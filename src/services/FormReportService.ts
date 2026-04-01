import ExcelJS from 'exceljs';
import { Response } from 'express';
import { AppDataSource } from '../data-source';
import { Form } from '../entity/Form.entity';
import { UserForm } from '../entity/UserForm.entity';
import { Learner } from '../entity/Learner.entity';
import {
    getAccessibleOrganisationIds,
    getScopeContext,
    ScopeContext,
    resolveUserRole,
} from '../util/organisationFilter';
import { UserRole } from '../util/constants';

export class ReportValidationError extends Error {
    constructor(
        public readonly statusCode: number,
        message: string
    ) {
        super(message);
        this.name = 'ReportValidationError';
    }
}

const BATCH_SIZE = 500;

/** Normalise JSON column from DB (Postgres may return object or string). */
export function parseJsonObject(raw: unknown): Record<string, unknown> {
    if (raw == null) return {};
    if (typeof raw === 'string') {
        try {
            const p = JSON.parse(raw) as unknown;
            return typeof p === 'object' && p !== null && !Array.isArray(p) ? (p as Record<string, unknown>) : {};
        } catch {
            return {};
        }
    }
    if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
    return {};
}

/**
 * Read value by dot path and bracket indices, e.g. "section.answer" or "items.0.name".
 */
export function getNestedValue(obj: unknown, path: string): unknown {
    if (path == null || path === '') return undefined;
    const normalised = path.trim().replace(/\[(\d+)\]/g, '.$1');
    const segments = normalised.split('.').filter(Boolean);
    let cur: unknown = obj;
    for (const seg of segments) {
        if (cur == null) return undefined;
        if (typeof cur !== 'object') return undefined;
        cur = (cur as Record<string, unknown>)[seg];
    }
    return cur;
}

/** Deep search form template JSON for a human-readable label for a field key. */
export function findLabelInStructure(node: unknown, needle: string): string | null {
    if (node == null) return null;
    if (typeof node !== 'object') return null;
    if (Array.isArray(node)) {
        for (const item of node) {
            const found = findLabelInStructure(item, needle);
            if (found) return found;
        }
        return null;
    }
    const obj = node as Record<string, unknown>;
    const keyFields = ['id', 'name', 'fieldName', 'key', 'fieldId', 'field_id'];
    for (const k of keyFields) {
        const v = obj[k];
        if (v === needle || (v != null && String(v) === needle)) {
            const label = obj.label ?? obj.title ?? obj.question ?? obj.text ?? obj.placeholder;
            if (typeof label === 'string' && label.trim()) return label.trim();
        }
    }
    for (const v of Object.values(obj)) {
        const found = findLabelInStructure(v, needle);
        if (found) return found;
    }
    return null;
}

export function formatCellValue(value: unknown): string | number | boolean {
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean' || typeof value === 'number') return value;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
        if (value.every((x) => typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean')) {
            return value.map(String).join('; ');
        }
        try {
            return JSON.stringify(value);
        } catch {
            return '';
        }
    }
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch {
            return '';
        }
    }
    return String(value);
}

function applyFileUrlsToFormData(
    formData: Record<string, unknown>,
    formFiles: UserForm['form_files']
): void {
    if (!formFiles?.length) return;
    for (const group of formFiles) {
        if (!group?.files?.length) continue;
        for (const file of group.files) {
            if (file?.file_key != null) {
                formData[file.file_key] = file.file_url as unknown;
            }
        }
    }
}

function dedupeFields(fields: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const f of fields) {
        if (typeof f !== 'string' || !f.trim()) continue;
        const t = f.trim();
        if (seen.has(t)) continue;
        seen.add(t);
        out.push(t);
    }
    return out;
}

type NormalizedField = {
    id: string;
    label: string;
};

function normalizeTemplateField(node: unknown): NormalizedField | null {
    if (node == null || typeof node !== 'object' || Array.isArray(node)) return null;
    const obj = node as Record<string, unknown>;
    const idRaw = obj.id ?? obj.fieldId ?? obj.field_id ?? obj.key ?? obj.name ?? obj.fieldName;
    const labelRaw = obj.label ?? obj.title ?? obj.question ?? obj.text ?? obj.placeholder;
    const id = idRaw != null ? String(idRaw).trim() : '';
    const label = labelRaw != null ? String(labelRaw).trim() : '';
    if (!id) return null;
    return { id, label: label || id };
}

function collectTemplateFields(node: unknown, out: NormalizedField[] = []): NormalizedField[] {
    if (node == null || typeof node !== 'object') return out;
    if (Array.isArray(node)) {
        for (const item of node) collectTemplateFields(item, out);
        return out;
    }
    const f = normalizeTemplateField(node);
    if (f) out.push(f);
    for (const v of Object.values(node as Record<string, unknown>)) {
        collectTemplateFields(v, out);
    }
    return out;
}

function buildTemplateFieldMaps(formStructure: unknown): {
    byId: Map<string, NormalizedField>;
    byLabelLower: Map<string, NormalizedField>;
} {
    const fields = collectTemplateFields(formStructure);
    const byId = new Map<string, NormalizedField>();
    const byLabelLower = new Map<string, NormalizedField>();
    for (const f of fields) {
        if (!byId.has(f.id)) byId.set(f.id, f);
        const lower = f.label.toLowerCase();
        if (lower && !byLabelLower.has(lower)) byLabelLower.set(lower, f);
    }
    return { byId, byLabelLower };
}

async function loadFormWithAccess(
    formId: number,
    user: any,
    scopeContext: ScopeContext
): Promise<Form | null> {
    const formRepository = AppDataSource.getRepository(Form);
    const qb = formRepository.createQueryBuilder('form').where('form.id = :id', { id: formId });

    if (user) {
        const accessibleIds = await getAccessibleOrganisationIds(user, scopeContext);
        if (accessibleIds !== null) {
            if (accessibleIds.length === 0) {
                return null;
            }
            qb.innerJoin('form.users', 'formUser')
                .innerJoin('formUser.userOrganisations', 'uo')
                .andWhere('uo.organisation_id IN (:...orgIds)', { orgIds: accessibleIds });
        }
    }
    return qb.getOne();
}

function buildUserFormsQuery(formId: number, user: any) {
    const userFormRepository = AppDataSource.getRepository(UserForm);
    const qb = userFormRepository
        .createQueryBuilder('user_form')
        .innerJoinAndSelect('user_form.user', 'user')
        .where('user_form.form = :formId', { formId })
        .leftJoinAndMapOne('user_form._learner', Learner, 'learner', 'learner.user_id = user.user_id')
        .leftJoin('learner', 'learner_scope', 'learner_scope.user_id = user.user_id')
        .leftJoin('user_course', 'uc', 'uc.learner_id = learner_scope.learner_id');

    if (resolveUserRole(user) === UserRole.Trainer) {
        qb.andWhere('uc.trainer_id = :trainer_id', { trainer_id: user.user_id });
    }

    return qb.orderBy('user_form.id', 'ASC');
}

type StandardField = {
    key: string;
    label: string;
    aliases: string[];
    getValue: (uf: any) => unknown;
};

const STANDARD_FIELDS: StandardField[] = [
    // Standard report fields
    { key: 'id', label: 'Id', aliases: ['submission id', 'record id'], getValue: (uf) => uf?.id },
    {
        key: 'completed_date',
        label: 'Completed Date',
        aliases: ['completion date'],
        getValue: (uf) => (uf?.is_locked ? uf?.locked_at ?? uf?.updated_at : ''),
    },
    { key: 'date_assigned', label: 'Date Assigned', aliases: ['assigned date'], getValue: (uf) => uf?.created_at },
    {
        key: 'location_assigned',
        label: 'Location Assigned',
        aliases: ['assigned location'],
        getValue: (uf) => uf?._learner?.location,
    },

    // Learner profile fields
    { key: 'learner_id', label: 'Learner ID', aliases: [], getValue: (uf) => uf?._learner?.learner_id },
    { key: 'learner_first_name', label: 'Learner First Name', aliases: ['first name', 'learner name'], getValue: (uf) => uf?._learner?.first_name },
    { key: 'learner_last_name', label: 'Learner Last Name', aliases: ['last name', 'surname'], getValue: (uf) => uf?._learner?.last_name },
    {
        key: 'learner_full_name',
        label: 'Learner Full Name',
        aliases: ['full name', 'learner fullname'],
        getValue: (uf) => {
            const first = uf?._learner?.first_name ?? '';
            const last = uf?._learner?.last_name ?? '';
            return `${first} ${last}`.trim();
        },
    },
    { key: 'dob', label: 'DOB', aliases: ['date of birth'], getValue: (uf) => uf?._learner?.dob },
    { key: 'email', label: 'Email', aliases: ['email address'], getValue: (uf) => uf?._learner?.email ?? uf?.user?.email },
    { key: 'mobile', label: 'Mobile', aliases: ['phone'], getValue: (uf) => uf?._learner?.mobile },
    { key: 'uln', label: 'ULN', aliases: [], getValue: (uf) => uf?._learner?.uln },
    { key: 'job_title', label: 'Job Title', aliases: [], getValue: (uf) => uf?._learner?.job_title },
    { key: 'location', label: 'Location', aliases: [], getValue: (uf) => uf?._learner?.location },
];

function resolveStandardField(input: string): StandardField | null {
    const needle = input.trim().toLowerCase();
    return (
        STANDARD_FIELDS.find((f) =>
            f.key.toLowerCase() === needle ||
            f.label.toLowerCase() === needle ||
            f.aliases.some((a) => a.toLowerCase() === needle)
        ) ?? null
    );
}

function getStandardFieldOptions() {
    return STANDARD_FIELDS.map((f) => ({
        key: f.key,
        label: f.label,
        type: 'standard' as const,
    }));
}

export class FormReportService {
    async getFieldOptions(
        formId: number,
        user: any,
        req: { query?: any; headers?: any }
    ): Promise<{ standard_fields: Array<{ key: string; label: string; type: 'standard' }>; custom_fields: Array<{ key: string; label: string; type: 'custom' }> }> {
        if (!Number.isFinite(formId) || formId < 1) {
            throw new ReportValidationError(400, 'formId must be a positive number');
        }

        const scopeContext = getScopeContext(req);
        const formRepository = AppDataSource.getRepository(Form);
        const exists = await formRepository.findOne({ where: { id: formId } });
        if (!exists) {
            throw new ReportValidationError(404, 'Form not found');
        }

        const form = await loadFormWithAccess(formId, user, scopeContext);
        if (!form) {
            throw new ReportValidationError(403, 'You do not have access to this form');
        }

        const maps = buildTemplateFieldMaps(form.form_data);
        const custom_fields = Array.from(maps.byId.values()).map((f) => ({
            key: f.id,
            label: f.label,
            type: 'custom' as const,
        }));

        return {
            standard_fields: getStandardFieldOptions(),
            custom_fields,
        };
    }

    /**
     * Streams an .xlsx to the response. Sets headers.
     * Uses batched DB reads (BATCH_SIZE) and ExcelJS streaming writer to limit memory growth.
     */
    async streamFormReportExcel(
        res: Response,
        formId: number,
        selectedFields: string[],
        user: any,
        req: { query?: any; headers?: any }
    ): Promise<void> {
        if (!Number.isFinite(formId) || formId < 1) {
            throw new ReportValidationError(400, 'formId must be a positive number');
        }
        if (!Array.isArray(selectedFields)) {
            throw new ReportValidationError(400, 'selectedFields must be an array');
        }
        const requested = dedupeFields(selectedFields);
        if (requested.length === 0) {
            throw new ReportValidationError(400, 'selectedFields must contain at least one non-empty field key');
        }
        // "Id" is mandatory in report export.
        if (!requested.some((f) => f.trim().toLowerCase() === 'id')) {
            requested.unshift('id');
        }

        const scopeContext = getScopeContext(req);
        const formRepository = AppDataSource.getRepository(Form);
        const exists = await formRepository.findOne({ where: { id: formId } });
        if (!exists) {
            throw new ReportValidationError(404, 'Form not found');
        }
        const form = await loadFormWithAccess(formId, user, scopeContext);
        if (!form) {
            throw new ReportValidationError(403, 'You do not have access to this form');
        }

        const formStructure = form.form_data;
        const maps = buildTemplateFieldMaps(formStructure);
        const resolved = requested.map((f) => {
            const std = resolveStandardField(f);
            if (std) {
                return { source: 'standard' as const, key: std.key, header: std.label, getValue: std.getValue };
            }
            const byId = maps.byId.get(f);
            if (byId) return { source: 'custom' as const, key: byId.id, header: byId.label };
            const byLabel = maps.byLabelLower.get(f.toLowerCase());
            if (byLabel) return { source: 'custom' as const, key: byLabel.id, header: byLabel.label };
            const fallbackLabel = findLabelInStructure(formStructure, f) ?? f;
            return { source: 'custom' as const, key: f, header: fallbackLabel };
        });
        const allHeaders = resolved.map((x) => x.header);

        const safeName = (form.form_name || `form-${formId}`).replace(/[^\w\-]+/g, '_').slice(0, 80);
        const filename = `${safeName}-report.xlsx`;

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
            stream: res,
            useSharedStrings: false,
            useStyles: false,
        });
        const worksheet = workbook.addWorksheet('Submissions', {
            properties: { defaultRowHeight: 16 },
        });

        worksheet.addRow(allHeaders).commit();

        const qb = buildUserFormsQuery(formId, user);
        let skip = 0;
        for (;;) {
            const batch = await qb.clone().skip(skip).take(BATCH_SIZE).getMany();
            if (batch.length === 0) break;

            for (const uf of batch) {
                const rawData = parseJsonObject(uf.form_data);
                const rowData = { ...rawData };
                applyFileUrlsToFormData(rowData, uf.form_files);

                const cells = resolved.map((f: any) => {
                    if (f.source === 'standard') {
                        return formatCellValue(f.getValue(uf));
                    }
                    // Prefer template id key, but fall back to label key for older stored payloads.
                    const direct = getNestedValue(rowData, f.key);
                    if (direct !== undefined) return formatCellValue(direct);
                    const byHeader = getNestedValue(rowData, f.header);
                    return formatCellValue(byHeader);
                });
                worksheet.addRow(cells).commit();
            }

            skip += batch.length;
            if (batch.length < BATCH_SIZE) break;
        }

        await worksheet.commit();
        await workbook.commit();
    }
}

export const formReportService = new FormReportService();

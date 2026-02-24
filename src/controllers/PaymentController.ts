import { Response } from 'express';
import { AppDataSource } from '../data-source';
import { Payment } from '../entity/Payment.entity';
import { Plan } from '../entity/Plan.entity';
import { CustomRequest } from '../util/Interface/expressInterface';
import { UserRole } from '../util/constants';
import { applyScope } from '../util/organisationFilter';

interface LineItemInput {
    periodIndex: number;
    periodLabel: string;
    dueDate: string;
    amount: number;
    discountPercent?: number;
    taxPercent?: number;
    status: string;
    paidDate?: string;
}

function computeTotalsFromLineItems(lineItems: LineItemInput[]): {
    amount: number;
    subtotal: number;
    totalDiscount: number;
    totalTax: number;
    total: number;
} {
    let amount = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let total = 0;
    for (const item of lineItems) {
        const amt = Number(item.amount) || 0;
        amount += amt;
        const dPct = item.discountPercent ?? 0;
        const tPct = item.taxPercent ?? 0;
        const discountAmount = (amt * dPct) / 100;
        const amountAfterDiscount = amt - discountAmount;
        const taxAmount = (amountAfterDiscount * tPct) / 100;
        const rowTotal = amountAfterDiscount + taxAmount;
        totalDiscount += discountAmount;
        totalTax += taxAmount;
        total += rowTotal;
    }
    const subtotal = amount;
    total = Math.round(total * 100) / 100;
    totalDiscount = Math.round(totalDiscount * 100) / 100;
    totalTax = Math.round(totalTax * 100) / 100;
    return { amount, subtotal, totalDiscount, totalTax, total };
}

function mapPaymentToResponse(p: Payment, planName?: string): Record<string, unknown> {
    const dateStr = typeof p.date === 'string' ? p.date : (p.date as Date)?.toISOString?.()?.split('T')[0] ?? '';
    return {
        id: p.id,
        date: dateStr,
        organisationId: p.organisation_id,
        amount: Number(p.amount),
        status: p.status,
        invoiceNumber: p.invoice_number ?? undefined,
        paymentMethod: p.payment_method ?? undefined,
        planId: p.plan_id,
        planName: planName ?? undefined,
        subtotal: p.subtotal != null ? Number(p.subtotal) : undefined,
        discountType: p.discount_type ?? undefined,
        discountValue: p.discount_value != null ? Number(p.discount_value) : undefined,
        taxType: p.tax_type ?? undefined,
        taxValue: p.tax_value != null ? Number(p.tax_value) : undefined,
        total: p.total != null ? Number(p.total) : undefined,
        currency: p.currency ?? undefined,
        notes: p.notes ?? undefined,
        lineItems: p.line_items ?? [],
    };
}

async function generateInvoiceNumber(): Promise<string> {
    const repo = AppDataSource.getRepository(Payment);
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `INV-${today}-`;
    const existing = await repo
        .createQueryBuilder('p')
        .select('p.invoice_number')
        .where('p.invoice_number LIKE :prefix', { prefix: `${prefix}%` })
        .orderBy('p.invoice_number', 'DESC')
        .getMany();
    let seq = 1;
    if (existing.length > 0) {
        const last = existing[0].invoice_number as string;
        const num = parseInt(last.replace(prefix, ''), 10);
        if (!isNaN(num)) seq = num + 1;
    }
    const suffix = String(seq).padStart(3, '0');
    return `${prefix}${suffix}`;
}

export default class PaymentController {
    public async GetPayments(req: CustomRequest, res: Response) {
        try {
            const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit), 10) || 10));
            const organisationId = req.query.organisationId ? parseInt(String(req.query.organisationId), 10) : undefined;
            const status = req.query.status as string | undefined;
            const dateFrom = req.query.dateFrom as string | undefined;
            const dateTo = req.query.dateTo as string | undefined;

            const repo = AppDataSource.getRepository(Payment);
            const qb = repo.createQueryBuilder('payment')
                .leftJoinAndSelect('payment.plan', 'plan')
                .orderBy('payment.date', 'DESC')
                .addOrderBy('payment.id', 'DESC');

            if (req.user) {
                await applyScope(qb, req.user, 'payment', { organisationOnly: true });
            }

            if (organisationId != null && !isNaN(organisationId)) {
                qb.andWhere('payment.organisation_id = :organisationId', { organisationId });
            }
            if (status && status.trim()) {
                qb.andWhere('payment.status = :status', { status: status.trim() });
            }
            if (dateFrom && dateFrom.trim()) {
                qb.andWhere('payment.date >= :dateFrom', { dateFrom: dateFrom.trim() });
            }
            if (dateTo && dateTo.trim()) {
                qb.andWhere('payment.date <= :dateTo', { dateTo: dateTo.trim() });
            }

            const [payments, total] = await qb
                .skip((page - 1) * limit)
                .take(limit)
                .getManyAndCount();

            const data = payments.map((p) => mapPaymentToResponse(p, (p as Payment & { plan?: Plan }).plan?.name));
            const totalPages = Math.ceil(total / limit);

            return res.status(200).json({
                message: 'Payments retrieved successfully',
                status: true,
                data,
                meta: {
                    page,
                    limit,
                    total,
                    totalPages,
                },
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: (error as Error).message,
            });
        }
    }

    public async GetPayment(req: CustomRequest, res: Response) {
        try {
            const id = parseInt(req.params.id, 10);
            if (isNaN(id)) {
                return res.status(400).json({ message: 'Invalid payment id', status: false });
            }
            const repo = AppDataSource.getRepository(Payment);
            const payment = await repo.findOne({
                where: { id },
                relations: ['plan'],
            });
            if (!payment) {
                return res.status(404).json({ message: 'Payment not found', status: false });
            }
            const planName = (payment as Payment & { plan?: Plan }).plan?.name;
            return res.status(200).json({
                message: 'Payment retrieved successfully',
                status: true,
                data: mapPaymentToResponse(payment, planName),
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: (error as Error).message,
            });
        }
    }

    public async CreatePayment(req: CustomRequest, res: Response) {
        try {
            if (req.user?.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: 'Only MasterAdmin can create payments',
                    status: false,
                });
            }

            const { organisationId, planId, date, lineItems, currency, status, paymentMethod, notes } = req.body;

            if (organisationId == null || planId == null || !date) {
                return res.status(400).json({
                    message: 'organisationId, planId and date are required',
                    status: false,
                });
            }
            if (!Array.isArray(lineItems) || lineItems.length === 0) {
                return res.status(400).json({
                    message: 'At least one line item is required',
                    status: false,
                });
            }

            const planRepo = AppDataSource.getRepository(Plan);
            const plan = await planRepo.findOne({ where: { id: Number(planId) } });
            if (!plan) {
                return res.status(404).json({ message: 'Plan not found', status: false });
            }

            const { amount, subtotal, totalDiscount, totalTax, total } = computeTotalsFromLineItems(lineItems);
            const invoiceNumber = await generateInvoiceNumber();
            const dateStr = typeof date === 'string' ? date.split('T')[0] : new Date(date).toISOString().split('T')[0];

            const repo = AppDataSource.getRepository(Payment);
            const payment = repo.create({
                date: dateStr,
                organisation_id: Number(organisationId),
                plan_id: Number(planId),
                amount,
                status: (['draft', 'sent', 'failed', 'refunded'].includes(status) ? status : 'draft'),
                invoice_number: invoiceNumber,
                payment_method: paymentMethod || null,
                currency: currency || 'GBP',
                notes: notes || null,
                subtotal,
                discount_type: 'percentage',
                discount_value: totalDiscount,
                tax_type: 'percentage',
                tax_value: totalTax,
                total,
                line_items: lineItems,
            });

            const saved = await repo.save(payment);
            return res.status(201).json({
                message: 'Payment created successfully',
                status: true,
                data: mapPaymentToResponse(saved, plan.name),
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: (error as Error).message,
            });
        }
    }

    public async UpdatePayment(req: CustomRequest, res: Response) {
        try {
            if (req.user?.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: 'Only MasterAdmin can update payments',
                    status: false,
                });
            }

            const id = parseInt(req.params.id, 10);
            if (isNaN(id)) {
                return res.status(400).json({ message: 'Invalid payment id', status: false });
            }

            const { organisationId, planId, date, lineItems, currency, status, paymentMethod, notes } = req.body;

            if (organisationId == null || planId == null || !date) {
                return res.status(400).json({
                    message: 'organisationId, planId and date are required',
                    status: false,
                });
            }
            if (!Array.isArray(lineItems) || lineItems.length === 0) {
                return res.status(400).json({
                    message: 'At least one line item is required',
                    status: false,
                });
            }

            const repo = AppDataSource.getRepository(Payment);
            const payment = await repo.findOne({ where: { id }, relations: ['plan'] });
            if (!payment) {
                return res.status(404).json({ message: 'Payment not found', status: false });
            }

            const planRepo = AppDataSource.getRepository(Plan);
            const plan = await planRepo.findOne({ where: { id: Number(planId) } });
            if (!plan) {
                return res.status(404).json({ message: 'Plan not found', status: false });
            }

            const { amount, subtotal, totalDiscount, totalTax, total } = computeTotalsFromLineItems(lineItems);
            const dateStr = typeof date === 'string' ? date.split('T')[0] : new Date(date).toISOString().split('T')[0];

            payment.date = dateStr;
            payment.organisation_id = Number(organisationId);
            payment.plan_id = Number(planId);
            payment.amount = amount;
            payment.status = (['draft', 'sent', 'failed', 'refunded'].includes(status) ? status : payment.status);
            payment.payment_method = paymentMethod ?? null;
            payment.currency = currency ?? 'GBP';
            payment.notes = notes ?? null;
            payment.subtotal = subtotal;
            payment.discount_type = 'percentage';
            payment.discount_value = totalDiscount;
            payment.tax_type = 'percentage';
            payment.tax_value = totalTax;
            payment.total = total;
            payment.line_items = lineItems;

            const saved = await repo.save(payment);
            return res.status(200).json({
                message: 'Payment updated successfully',
                status: true,
                data: mapPaymentToResponse(saved, plan.name),
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: (error as Error).message,
            });
        }
    }
}

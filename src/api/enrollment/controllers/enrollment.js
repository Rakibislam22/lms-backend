'use strict';

/**
 * enrollment controller
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { getRoleType, isContentManagerOrAdmin } = require('../../../utils/access');

module.exports = createCoreController('api::enrollment.enrollment', ({ strapi }) => ({
    async find(ctx) {
        const role = await getRoleType(strapi, ctx.state.user);
        if (role === 'admin' || role === 'content_manager') {
            // Admin and Content Manager can view all enrollments
        } else if (role === 'instructor') {
            // Instructor can only view enrollments for their own courses
            ctx.query.filters = {
                ...(ctx.query.filters || {}),
                course: { owner: { id: { $eq: ctx.state.user.id } } },
            };
        } else {
            // Students can only view their own enrollments
            ctx.query.filters = {
                ...(ctx.query.filters || {}),
                student: { id: { $eq: ctx.state.user.id } },
            };
        }
        return super.find(ctx);
    },
    async findOne(ctx) {
        const enrollment = await strapi.db.query('api::enrollment.enrollment').findOne({
            where: { id: ctx.params.id },
            populate: ['student', 'course', 'course.owner'],
        });
        if (!enrollment) return ctx.notFound('Enrollment not found');

        const role = await getRoleType(strapi, ctx.state.user);
        const isSelfStudent = enrollment.student?.id === ctx.state.user.id;
        const isCourseInstructor = enrollment.course?.owner?.id === ctx.state.user.id;

        if (role !== 'admin' && role !== 'content_manager' && !isSelfStudent && !isCourseInstructor) {
            return ctx.forbidden('You do not have access to this enrollment');
        }
        return super.findOne(ctx);
    },
    async create(ctx) {
        ctx.request.body = ctx.request.body || {};
        const courseId = ctx.request.body.data?.course;
        const userId = ctx.state.user.id;

        // Prevent duplicate enrollments for the same student and course
        if (courseId) {
            const existing = await strapi.db.query('api::enrollment.enrollment').findOne({
                where: {
                    student: { id: userId },
                    course: { id: courseId },
                },
                populate: ['course'],
            });
            if (existing) {
                return ctx.send({ data: existing });
            }
        }

        ctx.request.body.data = {
            ...(ctx.request.body.data || {}),
            student: userId,
            progressPercent: 0,
        };
        return super.create(ctx);
    },
    async delete(ctx) {
        const enrollment = await strapi.db.query('api::enrollment.enrollment').findOne({
            where: { id: ctx.params.id },
            populate: ['student'],
        });
        if (!enrollment) return ctx.notFound('Enrollment not found');

        const isPrivileged = await isContentManagerOrAdmin(strapi, ctx.state.user);
        if (!isPrivileged && enrollment?.student?.id !== ctx.state.user.id) {
            return ctx.forbidden('Not your enrollment');
        }
        return super.delete(ctx);
    },
}));

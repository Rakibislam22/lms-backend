'use strict';

/**
 * quiz controller
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { isContentManagerOrAdmin } = require('../../../utils/access');

module.exports = createCoreController('api::quiz.quiz', ({ strapi }) => ({
    async isCourseOwner(ctx, quiz) {
        if (await isContentManagerOrAdmin(strapi, ctx.state.user)) return true;
        const courseId = quiz?.course?.id ?? ctx.request.body?.data?.course;
        if (!courseId) return false;
        const course = await strapi.db.query('api::course.course').findOne({
            where: { id: courseId },
            populate: ['owner'],
        });
        return course?.owner?.id === ctx.state.user.id;
    },
    async create(ctx) {
        ctx.request.body = ctx.request.body || {};
        const allowed = await this.isCourseOwner(ctx);
        if (!allowed) return ctx.forbidden('You can only manage quizzes in your own courses');
        return super.create(ctx);
    },
    async update(ctx) {
        const quiz = await strapi.db.query('api::quiz.quiz').findOne({
            where: { id: ctx.params.id },
            populate: ['course'],
        });
        if (!quiz) return ctx.notFound('Quiz not found');
        const allowed = await this.isCourseOwner(ctx, quiz);
        if (!allowed) return ctx.forbidden('You can only manage quizzes in your own courses');
        return super.update(ctx);
    },
    async delete(ctx) {
        const quiz = await strapi.db.query('api::quiz.quiz').findOne({
            where: { id: ctx.params.id },
            populate: ['course'],
        });
        if (!quiz) return ctx.notFound('Quiz not found');
        const allowed = await this.isCourseOwner(ctx, quiz);
        if (!allowed) return ctx.forbidden('You can only manage quizzes in your own courses');
        return super.delete(ctx);
    },
}));

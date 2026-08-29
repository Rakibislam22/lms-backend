'use strict';

/**
 * quiz controller
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { isContentManagerOrAdmin } = require('../../../utils/access');

module.exports = createCoreController('api::quiz.quiz', ({ strapi }) => ({
    async findQuiz(idOrDocId) {
        if (!idOrDocId) return null;
        const isNumeric = /^\d+$/.test(String(idOrDocId));
        if (isNumeric) {
            return await strapi.db.query('api::quiz.quiz').findOne({
                where: { id: parseInt(idOrDocId, 10) },
                populate: ['course'],
            });
        }
        return await strapi.db.query('api::quiz.quiz').findOne({
            where: { documentId: idOrDocId },
            populate: ['course'],
        });
    },
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
        const quiz = await this.findQuiz(ctx.params.id);
        if (!quiz) return ctx.notFound('Quiz not found');
        const allowed = await this.isCourseOwner(ctx, quiz);
        if (!allowed) return ctx.forbidden('You can only manage quizzes in your own courses');
        // Ensure Strapi 5 core controller receives documentId
        ctx.params.id = quiz.documentId || quiz.id;
        return super.update(ctx);
    },
    async delete(ctx) {
        const quiz = await this.findQuiz(ctx.params.id);
        if (!quiz) return ctx.notFound('Quiz not found');
        const allowed = await this.isCourseOwner(ctx, quiz);
        if (!allowed) return ctx.forbidden('You can only manage quizzes in your own courses');
        ctx.params.id = quiz.documentId || quiz.id;
        return super.delete(ctx);
    },
}));

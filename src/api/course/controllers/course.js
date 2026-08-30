const { createCoreController } = require('@strapi/strapi').factories;
const { isContentManagerOrAdmin } = require('../../../utils/access');

module.exports = createCoreController('api::course.course', ({ strapi }) => ({
    async create(ctx) {
        ctx.request.body = ctx.request.body || {};
        if (!(await isContentManagerOrAdmin(strapi, ctx.state.user))) {
            ctx.request.body.data = {
                ...(ctx.request.body.data || {}),
                owner: ctx.state.user.id,
            };
        }
        return super.create(ctx);
    },

    async findOne(ctx) {
        const isNumeric = !isNaN(Number(ctx.params.id));
        const whereClause = isNumeric
            ? { id: Number(ctx.params.id) }
            : { documentId: ctx.params.id };

        const course = await strapi.db.query('api::course.course').findOne({
            where: whereClause,
            populate: ['owner', 'lessons', 'enrollments'],
        });
        if (!course) return ctx.notFound('Course not found');

        ctx.params.id = course.documentId || course.id;
        return super.findOne(ctx);
    },

    async update(ctx) {
        const isNumeric = !isNaN(Number(ctx.params.id));
        const whereClause = isNumeric
            ? { id: Number(ctx.params.id) }
            : { documentId: ctx.params.id };

        const course = await strapi.db.query('api::course.course').findOne({
            where: whereClause,
            populate: ['owner'],
        });
        if (!course) return ctx.notFound('Course not found');

        const user = ctx.state.user;
        const ownerId = course.owner?.id || (typeof course.owner === 'number' ? course.owner : null);
        if (!(await isContentManagerOrAdmin(strapi, user)) && ownerId !== user?.id) {
            return ctx.forbidden('You can only edit your own courses');
        }

        ctx.params.id = course.documentId || course.id;
        return super.update(ctx);
    },

    async delete(ctx) {
        const isNumeric = !isNaN(Number(ctx.params.id));
        const whereClause = isNumeric
            ? { id: Number(ctx.params.id) }
            : { documentId: ctx.params.id };

        const course = await strapi.db.query('api::course.course').findOne({
            where: whereClause,
            populate: ['owner'],
        });
        if (!course) return ctx.notFound('Course not found');

        const user = ctx.state.user;
        const ownerId = course.owner?.id || (typeof course.owner === 'number' ? course.owner : null);
        if (!(await isContentManagerOrAdmin(strapi, user)) && ownerId !== user?.id) {
            return ctx.forbidden('You can only delete your own courses');
        }

        // Cascade delete related records to prevent foreign key errors
        try {
            await strapi.db.query('api::lesson.lesson').deleteMany({
                where: { course: course.id }
            });
            await strapi.db.query('api::quiz.quiz').deleteMany({
                where: { course: course.id }
            });
            await strapi.db.query('api::enrollment.enrollment').deleteMany({
                where: { course: course.id }
            });
        } catch (cascadeErr) {
            strapi.log?.warn?.(`Cascade cleanup for course ${course.id}: ${cascadeErr.message}`);
        }

        ctx.params.id = course.documentId || course.id;
        return super.delete(ctx);
    },
}));

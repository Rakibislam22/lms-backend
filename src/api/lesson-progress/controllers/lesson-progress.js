'use strict';

/**
 * lesson-progress controller
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { getRoleType, isContentManagerOrAdmin } = require('../../../utils/access');

const updateCourseProgressPercent = async (strapi, studentId, courseId) => {
    if (!studentId || !courseId) return;

    // Get all lessons in the course
    const lessons = await strapi.db.query('api::lesson.lesson').findMany({
        where: { course: { id: courseId } },
        select: ['id'],
    });

    const totalLessons = lessons.length;
    if (totalLessons === 0) return;

    const lessonIds = lessons.map((l) => l.id);

    // Count completed lessons for this student
    const completedProgresses = await strapi.db.query('api::lesson-progress.lesson-progress').findMany({
        where: {
            student: { id: studentId },
            lesson: { id: { $in: lessonIds } },
            completed: true,
        },
        select: ['id'],
    });

    const completedCount = completedProgresses.length;
    const progressPercent = Math.min(100, Math.round((completedCount / totalLessons) * 100));

    // Update enrollment for this student and course
    const enrollment = await strapi.db.query('api::enrollment.enrollment').findOne({
        where: {
            student: { id: studentId },
            course: { id: courseId },
        },
        select: ['id'],
    });

    if (enrollment) {
        await strapi.db.query('api::enrollment.enrollment').update({
            where: { id: enrollment.id },
            data: { progressPercent },
        });
    }
};

module.exports = createCoreController('api::lesson-progress.lesson-progress', ({ strapi }) => ({
    async find(ctx) {
        const role = await getRoleType(strapi, ctx.state.user);
        if (role === 'admin' || role === 'content_manager') {
            // Full platform visibility
        } else if (role === 'instructor') {
            // Instructor sees progress of students in their courses
            ctx.query.filters = {
                ...(ctx.query.filters || {}),
                lesson: { course: { owner: { id: { $eq: ctx.state.user.id } } } },
            };
        } else {
            // Student sees only their own progress
            ctx.query.filters = {
                ...(ctx.query.filters || {}),
                student: { id: { $eq: ctx.state.user.id } },
            };
        }
        return super.find(ctx);
    },
    async findOne(ctx) {
        const progress = await strapi.db.query('api::lesson-progress.lesson-progress').findOne({
            where: { id: ctx.params.id },
            populate: ['student', 'lesson', 'lesson.course', 'lesson.course.owner'],
        });
        if (!progress) return ctx.notFound('Lesson progress not found');

        const role = await getRoleType(strapi, ctx.state.user);
        const isSelfStudent = progress.student?.id === ctx.state.user.id;
        const isCourseInstructor = progress.lesson?.course?.owner?.id === ctx.state.user.id;

        if (role !== 'admin' && role !== 'content_manager' && !isSelfStudent && !isCourseInstructor) {
            return ctx.forbidden('You do not have access to this progress record');
        }
        return super.findOne(ctx);
    },
    async create(ctx) {
        ctx.request.body = ctx.request.body || {};
        const userId = ctx.state.user.id;
        const lessonId = ctx.request.body.data?.lesson;
        const completed = ctx.request.body.data?.completed ?? true;

        if (lessonId) {
            // Check if progress entry already exists for this student & lesson
            const existing = await strapi.db.query('api::lesson-progress.lesson-progress').findOne({
                where: {
                    student: { id: userId },
                    lesson: { id: lessonId },
                },
                populate: ['lesson', 'lesson.course'],
            });

            if (existing) {
                const updated = await strapi.db.query('api::lesson-progress.lesson-progress').update({
                    where: { id: existing.id },
                    data: { completed },
                    populate: ['lesson'],
                });
                const courseId = existing.lesson?.course?.id;
                if (courseId) {
                    await updateCourseProgressPercent(strapi, userId, courseId);
                }
                return ctx.send({ data: updated });
            }
        }

        ctx.request.body.data = {
            ...(ctx.request.body.data || {}),
            student: userId,
            completed,
        };

        const result = await super.create(ctx);

        // Calculate and update course progress percentage
        if (lessonId) {
            const lesson = await strapi.db.query('api::lesson.lesson').findOne({
                where: { id: lessonId },
                populate: ['course'],
            });
            if (lesson?.course?.id) {
                await updateCourseProgressPercent(strapi, userId, lesson.course.id);
            }
        }

        return result;
    },
    async update(ctx) {
        const progress = await strapi.db.query('api::lesson-progress.lesson-progress').findOne({
            where: { id: ctx.params.id },
            populate: ['student', 'lesson', 'lesson.course'],
        });
        if (!progress) return ctx.notFound('Lesson progress not found');

        const isPrivileged = await isContentManagerOrAdmin(strapi, ctx.state.user);
        if (!isPrivileged && progress?.student?.id !== ctx.state.user.id) {
            return ctx.forbidden('Not your lesson progress');
        }

        const result = await super.update(ctx);

        const courseId = progress.lesson?.course?.id;
        const studentId = progress.student?.id;
        if (courseId && studentId) {
            await updateCourseProgressPercent(strapi, studentId, courseId);
        }

        return result;
    },
    async delete(ctx) {
        const progress = await strapi.db.query('api::lesson-progress.lesson-progress').findOne({
            where: { id: ctx.params.id },
            populate: ['student', 'lesson', 'lesson.course'],
        });
        if (!progress) return ctx.notFound('Lesson progress not found');

        const isPrivileged = await isContentManagerOrAdmin(strapi, ctx.state.user);
        if (!isPrivileged && progress?.student?.id !== ctx.state.user.id) {
            return ctx.forbidden('Not your lesson progress');
        }

        const result = await super.delete(ctx);

        const courseId = progress.lesson?.course?.id;
        const studentId = progress.student?.id;
        if (courseId && studentId) {
            await updateCourseProgressPercent(strapi, studentId, courseId);
        }

        return result;
    },
}));

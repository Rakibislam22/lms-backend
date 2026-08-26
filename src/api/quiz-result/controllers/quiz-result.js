'use strict';

/**
 * quiz-result controller
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { getRoleType, isContentManagerOrAdmin } = require('../../../utils/access');

module.exports = createCoreController('api::quiz-result.quiz-result', ({ strapi }) => ({
    async find(ctx) {
        const role = await getRoleType(strapi, ctx.state.user);
        if (role === 'admin' || role === 'content_manager') {
            // Platform-wide visibility
        } else if (role === 'instructor') {
            // Instructor sees quiz results for courses they own
            ctx.query.filters = {
                ...(ctx.query.filters || {}),
                quiz: { course: { owner: { id: { $eq: ctx.state.user.id } } } },
            };
        } else {
            // Student sees only their own results
            ctx.query.filters = {
                ...(ctx.query.filters || {}),
                student: { id: { $eq: ctx.state.user.id } },
            };
        }
        return super.find(ctx);
    },
    async findOne(ctx) {
        const result = await strapi.db.query('api::quiz-result.quiz-result').findOne({
            where: { id: ctx.params.id },
            populate: ['student', 'quiz', 'quiz.course', 'quiz.course.owner'],
        });
        if (!result) return ctx.notFound('Quiz result not found');

        const role = await getRoleType(strapi, ctx.state.user);
        const isSelfStudent = result.student?.id === ctx.state.user.id;
        const isCourseInstructor = result.quiz?.course?.owner?.id === ctx.state.user.id;

        if (role !== 'admin' && role !== 'content_manager' && !isSelfStudent && !isCourseInstructor) {
            return ctx.forbidden('You do not have access to this quiz result');
        }
        return super.findOne(ctx);
    },
    async create(ctx) {
        ctx.request.body = ctx.request.body || {};
        const { quiz: quizId, answers } = ctx.request.body.data || {};
        const userId = ctx.state.user.id;

        if (!quizId) {
            return ctx.badRequest('Quiz ID is required');
        }

        const quiz = await strapi.db.query('api::quiz.quiz').findOne({
            where: { id: quizId },
        });

        if (!quiz) {
            return ctx.notFound('Quiz not found');
        }

        let questions = [];
        if (Array.isArray(quiz.questions)) {
            questions = quiz.questions;
        } else if (typeof quiz.questions === 'string') {
            try {
                questions = JSON.parse(quiz.questions);
            } catch {
                questions = [];
            }
        }

        let score = 0;
        const totalQuestions = questions.length;

        // Auto-grade student's answers
        if (Array.isArray(answers)) {
            questions.forEach((q, idx) => {
                const studentAns = answers[idx];
                const correctAns = q.correctAnswer ?? q.answer ?? q.correctOption ?? q.correctIndex;
                if (
                    studentAns !== undefined &&
                    correctAns !== undefined &&
                    String(studentAns).trim().toLowerCase() === String(correctAns).trim().toLowerCase()
                ) {
                    score += 1;
                }
            });
        } else if (answers && typeof answers === 'object') {
            questions.forEach((q, idx) => {
                const studentAns = answers[idx] ?? answers[q.id] ?? answers[String(idx)];
                const correctAns = q.correctAnswer ?? q.answer ?? q.correctOption ?? q.correctIndex;
                if (
                    studentAns !== undefined &&
                    correctAns !== undefined &&
                    String(studentAns).trim().toLowerCase() === String(correctAns).trim().toLowerCase()
                ) {
                    score += 1;
                }
            });
        }

        ctx.request.body.data = {
            student: userId,
            quiz: quizId,
            score,
            totalQuestions,
            answers: answers ?? [],
        };

        return super.create(ctx);
    },
    async delete(ctx) {
        const result = await strapi.db.query('api::quiz-result.quiz-result').findOne({
            where: { id: ctx.params.id },
            populate: ['student'],
        });
        if (!result) return ctx.notFound('Quiz result not found');

        const isPrivileged = await isContentManagerOrAdmin(strapi, ctx.state.user);
        if (!isPrivileged && result?.student?.id !== ctx.state.user.id) {
            return ctx.forbidden('Not your quiz result');
        }
        return super.delete(ctx);
    },
}));

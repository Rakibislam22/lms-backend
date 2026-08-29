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

        if (!ctx.query.populate || ctx.query.populate === '*') {
            ctx.query.populate = {
                student: true,
                quiz: {
                    populate: {
                        course: true,
                    },
                },
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

        let quiz = null;
        if (/^\d+$/.test(String(quizId))) {
            quiz = await strapi.db.query('api::quiz.quiz').findOne({
                where: { id: parseInt(quizId, 10) },
            });
        }
        if (!quiz) {
            quiz = await strapi.db.query('api::quiz.quiz').findOne({
                where: { documentId: quizId },
            });
        }

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

        const checkAnswerCorrect = (q, studentAns) => {
            if (studentAns === undefined || studentAns === null || studentAns === '') return false;

            const cleanStudent = String(studentAns).trim().toLowerCase();

            // 1. Direct match with correctAnswer or answer
            const correctAns = q.correctAnswer ?? q.answer ?? q.correctOption;
            if (correctAns !== undefined && cleanStudent === String(correctAns).trim().toLowerCase()) {
                return true;
            }

            // 2. Option index match
            const correctIdx = q.correctIndex !== undefined ? parseInt(q.correctIndex, 10) : null;
            if (correctIdx !== null && !isNaN(correctIdx)) {
                if (cleanStudent === String(correctIdx)) return true;

                if (Array.isArray(q.options) && q.options[correctIdx] !== undefined) {
                    if (cleanStudent === String(q.options[correctIdx]).trim().toLowerCase()) {
                        return true;
                    }
                }
            }

            // 3. Option text match if correctAnswer is an index string/number
            if (Array.isArray(q.options)) {
                const parsedIdx = parseInt(String(correctAns).trim(), 10);
                if (!isNaN(parsedIdx) && q.options[parsedIdx] !== undefined) {
                    if (cleanStudent === String(q.options[parsedIdx]).trim().toLowerCase()) {
                        return true;
                    }
                }
                const studentIdx = parseInt(cleanStudent, 10);
                if (!isNaN(studentIdx) && q.options[studentIdx] !== undefined) {
                    if (String(q.options[studentIdx]).trim().toLowerCase() === String(correctAns).trim().toLowerCase()) {
                        return true;
                    }
                }
            }

            return false;
        };

        let score = 0;
        const totalQuestions = questions.length;

        // Auto-grade student's answers
        if (Array.isArray(answers)) {
            questions.forEach((q, idx) => {
                if (checkAnswerCorrect(q, answers[idx])) {
                    score += 1;
                }
            });
        } else if (answers && typeof answers === 'object') {
            questions.forEach((q, idx) => {
                const ans = answers[idx] ?? answers[q.id] ?? answers[String(idx)];
                if (checkAnswerCorrect(q, ans)) {
                    score += 1;
                }
            });
        }

        ctx.request.body.data = {
            student: userId,
            quiz: quiz.id,
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

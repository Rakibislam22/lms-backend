'use strict';

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }) {
    const SELF_ASSIGNABLE_ROLES = new Set(['student', 'instructor', 'content_manager']);
    try {
      const up = strapi.plugin('users-permissions');
      if (up) {
        const authCtrl = up.controller('auth');
        if (authCtrl && authCtrl.register) {
          const originalRegister = authCtrl.register;
          authCtrl.register = async (ctx) => {
            const requestedRole = ctx.request.body?.role ?? 'student';
            if (!SELF_ASSIGNABLE_ROLES.has(requestedRole)) {
              return ctx.badRequest('You can only sign up as a student, instructor, or content manager');
            }

            delete ctx.request.body.role;
            await originalRegister(ctx);

            const role = await strapi.db.query('plugin::users-permissions.role').findOne({
              where: {
                $or: [
                  { type: requestedRole },
                  { name: requestedRole },
                ],
              },
            });

            const userId = ctx.body?.user?.id;
            const documentId = ctx.body?.user?.documentId;
            if (!role || (!userId && !documentId)) return;

            if (requestedRole !== 'student') {
              if (documentId) {
                try {
                  await strapi.documents('plugin::users-permissions.user').update({
                    documentId,
                    data: { role: role.id },
                  });
                } catch (e) {
                  strapi.log?.warn?.(`Document update failed for ${documentId}: ${e.message}`);
                }
              }
              try {
                await strapi.db.query('plugin::users-permissions.user').update({
                  where: { id: userId },
                  data: { role: role.id },
                });
              } catch (e) {
                strapi.log?.warn?.(`DB update failed for ${userId}: ${e.message}`);
              }
            }

            if (ctx.body?.user) {
              ctx.body.user.role = {
                id: role.id,
                name: role.name,
                type: role.type,
                description: role.description,
              };
            }
          };
        }
      }
    } catch (e) {
      console.warn('Error in users-permissions register extension:', e.message);
    }
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    const roleNames = ['admin', 'content_manager', 'instructor', 'student'];
    for (const name of roleNames) {
      const existing = await strapi.query('plugin::users-permissions.role').findOne({ where: { type: name } });
      if (!existing) {
        await strapi.query('plugin::users-permissions.role').create({
          data: { name, description: `${name} role`, type: name },
        });
        console.log(`Created role: ${name}`);
      }
    }

    // New public registrations are students unless they explicitly choose the
    // safe instructor role. Privileged roles are assigned by an administrator.
    const store = strapi.store({ type: 'plugin', name: 'users-permissions' });
    const advanced = await store.get({ key: 'advanced' });
    if (advanced.default_role !== 'student') {
      await store.set({ key: 'advanced', value: { ...advanced, default_role: 'student' } });
    }

    const commonAuthPermissions = [
      'plugin::users-permissions.user.me',
      'plugin::users-permissions.user.find',
      'plugin::users-permissions.user.findOne',
      'plugin::users-permissions.auth.callback',
      'plugin::users-permissions.auth.changePassword',
      'plugin::users-permissions.auth.logout',
      'plugin::users-permissions.auth.getSessions',
      'plugin::users-permissions.auth.revokeSession',
      'plugin::users-permissions.auth.refresh',
    ];

    // Policies above provide the role and ownership checks; these permissions
    // make Strapi authenticate the request before the controller is reached.
    const permissionsByRole = {
      public: [
        'plugin::users-permissions.auth.callback',
        'plugin::users-permissions.auth.register',
        'plugin::users-permissions.auth.forgotPassword',
        'plugin::users-permissions.auth.resetPassword',
        'plugin::users-permissions.auth.emailConfirmation',
        'plugin::users-permissions.auth.sendEmailConfirmation',
        'plugin::users-permissions.auth.connect',
        'plugin::users-permissions.auth.refresh',
        'api::course.course.find',
        'api::course.course.findOne',
        'api::blog-post.blog-post.find',
        'api::blog-post.blog-post.findOne',
      ],
      authenticated: [
        ...commonAuthPermissions,
        'api::course.course.find',
        'api::course.course.findOne',
        'api::blog-post.blog-post.find',
        'api::blog-post.blog-post.findOne',
      ],
      admin: [
        ...commonAuthPermissions,
        'plugin::users-permissions.user.create',
        'plugin::users-permissions.user.update',
        'plugin::users-permissions.user.destroy',
        'plugin::users-permissions.user.stats',
        'plugin::users-permissions.user.updateRole',
        'plugin::users-permissions.role.find',
        'plugin::users-permissions.role.findOne',
        'api::blog-post.blog-post.find', 'api::blog-post.blog-post.findOne', 'api::blog-post.blog-post.create', 'api::blog-post.blog-post.update', 'api::blog-post.blog-post.delete',
        'api::course.course.find', 'api::course.course.findOne', 'api::course.course.create', 'api::course.course.update', 'api::course.course.delete',
        'api::lesson.lesson.find', 'api::lesson.lesson.findOne', 'api::lesson.lesson.create', 'api::lesson.lesson.update', 'api::lesson.lesson.delete',
        'api::quiz.quiz.find', 'api::quiz.quiz.findOne', 'api::quiz.quiz.create', 'api::quiz.quiz.update', 'api::quiz.quiz.delete',
        'api::enrollment.enrollment.find', 'api::enrollment.enrollment.findOne', 'api::enrollment.enrollment.create', 'api::enrollment.enrollment.update', 'api::enrollment.enrollment.delete',
        'api::lesson-progress.lesson-progress.find', 'api::lesson-progress.lesson-progress.findOne', 'api::lesson-progress.lesson-progress.create', 'api::lesson-progress.lesson-progress.update', 'api::lesson-progress.lesson-progress.delete',
        'api::quiz-result.quiz-result.find', 'api::quiz-result.quiz-result.findOne', 'api::quiz-result.quiz-result.create', 'api::quiz-result.quiz-result.update', 'api::quiz-result.quiz-result.delete',
      ],
      content_manager: [
        ...commonAuthPermissions,
        'api::blog-post.blog-post.find', 'api::blog-post.blog-post.findOne', 'api::blog-post.blog-post.create', 'api::blog-post.blog-post.update', 'api::blog-post.blog-post.delete',
        'api::course.course.find', 'api::course.course.findOne', 'api::course.course.create', 'api::course.course.update', 'api::course.course.delete',
        'api::lesson.lesson.find', 'api::lesson.lesson.findOne', 'api::lesson.lesson.create', 'api::lesson.lesson.update', 'api::lesson.lesson.delete',
        'api::quiz.quiz.find', 'api::quiz.quiz.findOne', 'api::quiz.quiz.create', 'api::quiz.quiz.update', 'api::quiz.quiz.delete',
        'api::enrollment.enrollment.find', 'api::enrollment.enrollment.findOne',
        'api::lesson-progress.lesson-progress.find', 'api::lesson-progress.lesson-progress.findOne',
        'api::quiz-result.quiz-result.find', 'api::quiz-result.quiz-result.findOne',
      ],
      instructor: [
        ...commonAuthPermissions,
        'api::course.course.find', 'api::course.course.findOne', 'api::course.course.create', 'api::course.course.update', 'api::course.course.delete',
        'api::lesson.lesson.find', 'api::lesson.lesson.findOne', 'api::lesson.lesson.create', 'api::lesson.lesson.update', 'api::lesson.lesson.delete',
        'api::quiz.quiz.find', 'api::quiz.quiz.findOne', 'api::quiz.quiz.create', 'api::quiz.quiz.update', 'api::quiz.quiz.delete',
        'api::enrollment.enrollment.find', 'api::enrollment.enrollment.findOne',
        'api::lesson-progress.lesson-progress.find', 'api::lesson-progress.lesson-progress.findOne',
        'api::quiz-result.quiz-result.find', 'api::quiz-result.quiz-result.findOne',
      ],
      student: [
        ...commonAuthPermissions,
        'api::course.course.find', 'api::course.course.findOne',
        'api::lesson.lesson.find', 'api::lesson.lesson.findOne',
        'api::quiz.quiz.find', 'api::quiz.quiz.findOne',
        'api::blog-post.blog-post.find', 'api::blog-post.blog-post.findOne',
        'api::enrollment.enrollment.find', 'api::enrollment.enrollment.findOne', 'api::enrollment.enrollment.create', 'api::enrollment.enrollment.delete',
        'api::lesson-progress.lesson-progress.find', 'api::lesson-progress.lesson-progress.findOne', 'api::lesson-progress.lesson-progress.create', 'api::lesson-progress.lesson-progress.update', 'api::lesson-progress.lesson-progress.delete',
        'api::quiz-result.quiz-result.find', 'api::quiz-result.quiz-result.findOne', 'api::quiz-result.quiz-result.create', 'api::quiz-result.quiz-result.delete',
      ],
    };

    for (const [type, actions] of Object.entries(permissionsByRole)) {
      const role = await strapi.db.query('plugin::users-permissions.role').findOne({ where: { type } });
      if (!role) continue;
      const existing = await strapi.db.query('plugin::users-permissions.permission').findMany({
        where: { role: role.id },
        select: ['action'],
      });
      const existingActions = new Set(existing.map(({ action }) => action));
      await Promise.all(actions.filter((action) => !existingActions.has(action)).map((action) =>
        strapi.db.query('plugin::users-permissions.permission').create({ data: { action, role: role.id } })
      ));
    }
  },
};

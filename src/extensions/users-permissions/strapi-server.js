'use strict';

const SELF_ASSIGNABLE_ROLES = new Set(['student', 'instructor']);

module.exports = (plugin) => {
  // In Strapi 5, plugin.controllers.auth and plugin.controllers.user are factory functions:
  // ({ strapi }) => controllerObject
  // Wrapping the factories ensures all overridden and custom methods are properly exported.

  const originalAuthFactory = plugin.controllers.auth;
  plugin.controllers.auth = (params) => {
    const controllers = typeof originalAuthFactory === 'function' ? originalAuthFactory(params) : originalAuthFactory;
    const originalRegister = controllers.register;

    controllers.register = async (ctx) => {
      const requestedRole = ctx.request.body?.role ?? 'student';
      if (!SELF_ASSIGNABLE_ROLES.has(requestedRole)) {
        return ctx.badRequest('You can only sign up as a student or instructor');
      }

      // The plugin's stock registration handler deliberately rejects unknown
      // fields. Remove role before calling it, then assign the vetted role.
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
            strapi.log?.warn?.(`Document service update failed for user ${documentId}: ${e.message}`);
          }
        }
        try {
          await strapi.db.query('plugin::users-permissions.user').update({
            where: { id: userId },
            data: { role: role.id },
          });
        } catch (e) {
          strapi.log?.warn?.(`DB query update failed for user ${userId}: ${e.message}`);
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

    return controllers;
  };

  const originalUserFactory = plugin.controllers.user;
  plugin.controllers.user = (params) => {
    const controllers = typeof originalUserFactory === 'function' ? originalUserFactory(params) : originalUserFactory;
    const originalFind = controllers.find;

    controllers.me = async (ctx) => {
      const authUser = ctx.state.user;
      if (!authUser) {
        return ctx.unauthorized();
      }

      const user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: authUser.id },
        populate: ['role'],
      });

      if (!user) {
        return ctx.notFound();
      }

      ctx.body = {
        id: user.id,
        documentId: user.documentId,
        username: user.username,
        email: user.email,
        provider: user.provider,
        confirmed: user.confirmed,
        blocked: user.blocked,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        role: user.role
          ? {
            id: user.role.id,
            name: user.role.name,
            type: user.role.type,
            description: user.role.description,
          }
          : null,
      };
    };

    controllers.find = async (ctx) => {
      const authUser = ctx.state.user;
      if (!authUser) return ctx.unauthorized();

      const currentUser = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: authUser.id },
        populate: ['role'],
      });

      if (currentUser?.role?.type !== 'admin') {
        return originalFind ? originalFind(ctx) : ctx.forbidden('Admin only');
      }

      const users = await strapi.db.query('plugin::users-permissions.user').findMany({
        populate: ['role'],
        orderBy: { createdAt: 'desc' },
      });

      ctx.body = users.map((u) => ({
        id: u.id,
        documentId: u.documentId,
        username: u.username,
        email: u.email,
        blocked: u.blocked,
        confirmed: u.confirmed,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        role: u.role
          ? {
            id: u.role.id,
            name: u.role.name,
            type: u.role.type,
            description: u.role.description,
          }
          : null,
      }));
    };

    controllers.updateRole = async (ctx) => {
      const authUser = ctx.state.user;
      if (!authUser) return ctx.unauthorized();

      const currentUser = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: authUser.id },
        populate: ['role'],
      });

      if (currentUser?.role?.type !== 'admin') {
        return ctx.forbidden('Only administrators can manage user roles');
      }

      const { id } = ctx.params;
      const { role: requestedRole } = ctx.request.body || {};

      if (!requestedRole) {
        return ctx.badRequest('Role is required');
      }

      let roleRecord;
      if (typeof requestedRole === 'number') {
        roleRecord = await strapi.db.query('plugin::users-permissions.role').findOne({
          where: { id: requestedRole },
        });
      } else {
        roleRecord = await strapi.db.query('plugin::users-permissions.role').findOne({
          where: { type: requestedRole },
        });
      }

      if (!roleRecord) {
        return ctx.badRequest(`Role '${requestedRole}' not found`);
      }

      const isNumeric = !isNaN(Number(id));
      let updatedUser;
      if (isNumeric) {
        const userEntry = await strapi.db.query('plugin::users-permissions.user').findOne({
          where: { id: Number(id) },
          select: ['documentId', 'id'],
        });
        if (!userEntry) return ctx.notFound('User not found');
        updatedUser = await strapi.documents('plugin::users-permissions.user').update({
          documentId: userEntry.documentId,
          data: { role: roleRecord.id },
          populate: ['role'],
        });
      } else {
        updatedUser = await strapi.documents('plugin::users-permissions.user').update({
          documentId: id,
          data: { role: roleRecord.id },
          populate: ['role'],
        });
      }

      if (!updatedUser) {
        return ctx.notFound('User not found');
      }

      ctx.body = {
        id: updatedUser.id,
        documentId: updatedUser.documentId,
        username: updatedUser.username,
        email: updatedUser.email,
        blocked: updatedUser.blocked,
        confirmed: updatedUser.confirmed,
        role: {
          id: roleRecord.id,
          name: roleRecord.name,
          type: roleRecord.type,
          description: roleRecord.description,
        },
      };
    };

    controllers.stats = async (ctx) => {
      const authUser = ctx.state.user;
      if (!authUser) return ctx.unauthorized();

      const currentUser = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: authUser.id },
        populate: ['role'],
      });

      if (currentUser?.role?.type !== 'admin') {
        return ctx.forbidden('Only administrators can access platform statistics');
      }

      const [users, totalCourses, totalLessons, totalEnrollments, totalQuizzes, totalBlogPosts, totalQuizResults] = await Promise.all([
        strapi.db.query('plugin::users-permissions.user').findMany({ populate: ['role'] }),
        strapi.db.query('api::course.course').count(),
        strapi.db.query('api::lesson.lesson').count(),
        strapi.db.query('api::enrollment.enrollment').count(),
        strapi.db.query('api::quiz.quiz').count(),
        strapi.db.query('api::blog-post.blog-post').count(),
        strapi.db.query('api::quiz-result.quiz-result').count(),
      ]);

      const usersByRole = {
        admin: 0,
        content_manager: 0,
        instructor: 0,
        student: 0,
        other: 0,
      };

      users.forEach((u) => {
        const type = u.role?.type;
        if (type && usersByRole[type] !== undefined) {
          usersByRole[type] += 1;
        } else {
          usersByRole.other += 1;
        }
      });

      ctx.body = {
        totalUsers: users.length,
        usersByRole,
        totalCourses,
        totalLessons,
        totalEnrollments,
        totalQuizzes,
        totalBlogPosts,
        totalQuizResults,
      };
    };

    return controllers;
  };

  // Add custom routes for admin statistics and role management
  const contentApiRouter = plugin.routes['content-api'];
  if (contentApiRouter && contentApiRouter.routes) {
    const registerRoute = contentApiRouter.routes.find(
      (route) => route.method === 'POST' && route.path === '/auth/local/register'
    );
    if (registerRoute) delete registerRoute.request;

    if (!contentApiRouter.routes.some((r) => r.path === '/admin/stats')) {
      contentApiRouter.routes.push(
        {
          method: 'GET',
          path: '/admin/stats',
          handler: 'user.stats',
          config: {
            prefix: '',
          },
        },
        {
          method: 'PUT',
          path: '/users/:id/role',
          handler: 'user.updateRole',
          config: {
            prefix: '',
          },
        }
      );
    }
  }

  return plugin;
};

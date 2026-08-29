'use strict';

const SELF_ASSIGNABLE_ROLES = new Set(['student', 'instructor', 'content_manager']);

module.exports = (plugin) => {
  const originalRegister = plugin.controllers.auth.register;

  // The stock route schema only permits username/email/password and rejects
  // `role` before our controller can validate it. The original controller is
  // still called below, so its normal registration validation remains intact.
  const registerRoute = plugin.routes['content-api'].routes.find(
    (route) => route.method === 'POST' && route.path === '/auth/local/register'
  );
  if (registerRoute) delete registerRoute.request;

  plugin.controllers.auth.register = async (ctx) => {
    const requestedRole = ctx.request.body?.role ?? 'student';
    if (!SELF_ASSIGNABLE_ROLES.has(requestedRole)) {
      return ctx.badRequest('You can only sign up as a student, instructor, or content manager');
    }

    // The plugin's stock registration handler deliberately rejects unknown
    // fields.  Remove role before calling it, then assign the vetted role.
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
    if (!role || !userId) return;

    const user = await strapi.db.query('plugin::users-permissions.user').update({
      where: { id: userId },
      data: { role: role.id },
      populate: ['role'],
    });
    ctx.body.user = await strapi.contentAPI.sanitize.output(
      user,
      strapi.getModel('plugin::users-permissions.user'),
      { auth: ctx.state.auth }
    );
  };

  plugin.controllers.user.me = async (ctx) => {
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

  const originalFind = plugin.controllers.user.find;
  plugin.controllers.user.find = async (ctx) => {
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

  plugin.controllers.user.updateRole = async (ctx) => {
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

    const updatedUser = await strapi.db.query('plugin::users-permissions.user').update({
      where: { id },
      data: { role: roleRecord.id },
      populate: ['role'],
    });

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

  plugin.controllers.user.stats = async (ctx) => {
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

  // Add custom routes for admin statistics and role management
  plugin.routes['content-api'].routes.push(
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

  return plugin;
};

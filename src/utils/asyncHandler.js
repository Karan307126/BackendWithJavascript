const asyncHandler = (requestHandler) => {
  (req, res, next) =>
    Promise.resolve(requestHandler(req, res, next)).catch((error) =>
      next(error)
    );
};

export { asyncHandler };

/* ********** Async Handler using Try Catch **********  */

// const asyncHandler = (requestHandler) => async (req, res, next) => {
//   try {
//     await requestHandler(req, res, next);
//   } catch (error) {
//     req.status(err.code || 500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// };

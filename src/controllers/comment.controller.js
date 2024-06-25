import mongoose from "mongoose";
import { Comment } from "../models/comment.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getVideoComment = asyncHandler(async (req, res) => {
  /*
  1. Extract videoId from the params
  2. Find the video details based on videoId
  3. Find the comments on video based on video field of comment model
  4. Add field to the comment model through join
  7. Send res back to frontend based on page no and limit 
  */

  const { videoId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  if (!videoId) throw new ApiError(400, "Video id is required");

  const pageNumber = parseInt(page);
  const limitNumber = parseInt(limit);

  const comments = await Comment.aggregate([
    {
      $match: {
        video: videoId,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "user",
      },
    },
    {
      $unwind: "$user",
    },
    {
      $addFields: {
        userName: "$user.userName",
      },
    },
    {
      $project: {
        content: 1,
        userName: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
    {
      $skip: (pageNumber - 1) * limitNumber,
    },
    {
      $limit: limitNumber,
    },
  ]);

  if (!comments) throw new ApiError(404, "There are no comments on this video");

  console.log("Comments : ", comments);

  return res
    .status(200)
    .json(new ApiResponse(200, comments, "Get comments successfully"));
});

const addComment = asyncHandler(async (req, res) => {
  /*
   1. Get content and userId from request body
   2. Get videoId from request params
   3. Find the user details using userId
   4. Check if user exists, if not, throw an error
   5. Create a new comment with videoId, userId, and content
   6. Save the new comment to the database
   7. Send back a response with the created comment details
  */

  const { videoId } = req.params;
  const { content } = req.body;

  const user = req.user;

  if (!user) throw new ApiError(404, "User not found");

  const comment = new Comment({
    video: videoId,
    owner: user._id,
    content: content,
  });

  await comment.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        content: comment.content,
        userName: user.userName,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
      },
      "Comment created successfully"
    )
  );
});

const updateComment = asyncHandler(async (req, res) => {
  // TODO: update a comment
});

const deleteComment = asyncHandler(async (req, res) => {
  // TODO: delete a comment
});

export { getVideoComment, addComment, updateComment, deleteComment };

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
  // TODO: add a comment to a video
});

const updateComment = asyncHandler(async (req, res) => {
  // TODO: update a comment
});

const deleteComment = asyncHandler(async (req, res) => {
  // TODO: delete a comment
});

export { getVideoComment, addComment, updateComment, deleteComment };

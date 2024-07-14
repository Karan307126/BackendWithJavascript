import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
  /*
   1. Get videoId and user details from request
   2. Check for existing like if like is exist then remove it else new like add
   3. Send back response
  */

  const { videoId } = req.params;
  const user = req.user;

  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video id");

  const existingLike = await Like.findOne({
    video: videoId,
    likedBy: user._id,
  });

  if (existingLike) {
    await existingLike.remove();
    return res
      .status(200)
      .json(new ApiResponse(200, null, "Video is unlike successfully."));
  } else {
    const newLike = new Like({
      video: videoId,
      likedBy: user._id,
    });
    await newLike.save();
    return res.status(200, newLike, "Video liked successfully.");
  }
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const user = req.user;

  if (!isValidObjectId(commentId))
    throw new ApiError(400, "Invalid comment id.");

  const existingCommentLike = await Like.findOne({
    comment: commentId,
    likedBy: user._id,
  });

  if (existingCommentLike) {
    await existingCommentLike.remove();
    return res
      .status(200)
      .json(new ApiResponse(200, null, "Comment unlike successfully."));
  } else {
    const newCommentLike = new Like({
      comment: commentId,
      likedBy: user._id,
    });

    return res
      .status(200)
      .json(
        new ApiResponse(200, newCommentLike, "Comment liked successfully.")
      );
  }
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  const user = req.user;

  if (!isValidObjectId(tweetId)) throw new ApiError(400, "Invalid tweet id.");

  const existingTweetLike = await Like.findOne({
    tweet: tweetId,
    likedBy: user._id,
  });

  if (existingTweetLike) {
    await existingTweetLike.remove();
    return res
      .status(200)
      .json(new ApiResponse(200, null, "Tweet unlike successfully."));
  } else {
    const newTweetLike = new Like({
      tweet: tweetId,
      likedBy: user._id,
    });

    return res
      .status(200)
      .json(new ApiResponse(200, newTweetLike, "Tweet liked successfully."));
  }
});

const getLikedVideos = asyncHandler(async (req, res) => {
  const user = req.user;

  const likedAllVideos = await Like.aggregate([
    {
      $match: {
        likedBy: user._id,
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "likedVideos",
      },
    },
    {
      $unwind: "$likedVideos",
    },
    {
      $project: {
        likedVideos: 1,
      },
    },
  ]);

  if (likedAllVideos.length > 0)
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          likedAllVideos,
          "Get all liked videos successfully."
        )
      );
  else
    return res
      .status(404)
      .json(new ApiResponse(404, null, "No liked video found."));
});

export { toggleCommentLike, toggleTweetLike, toggleVideoLike, getLikedVideos };

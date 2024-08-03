import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createTweet = asyncHandler(async (req, res) => {
  const user = req.user;
  const { content } = req.body;

  if (!user) throw new ApiError(404, "User is not logged in or does not exist");

  if (!content) throw new ApiError(400, "Content is required");

  const tweet = new Tweet({
    owner: user._id,
    content,
  });

  const savedTweet = await tweet.save();

  return res
    .status(200)
    .json(new ApiResponse(200, savedTweet, "Tweet created successfully"));
});

const getUserTweets = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!userId) throw new ApiError(400, "UserId is required");

  if (!isValidObjectId(userId)) throw new ApiError(400, "Invalid userId");

  const tweets = await Tweet.aggregate([
    {
      $match: {
        owner: mongoose.Types.ObjectId(userId),
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
        username: "$user.username",
      },
    },
    {
      $project: {
        owner: 1,
        username: 1,
        content: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ]);

  if (!tweets.length) throw new ApiError(404, "No tweets found for this user");

  return res
    .status(200)
    .json(new ApiResponse(200, tweets, "Tweets retrieved successfully"));
});

const updateTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  const { content } = req.body;

  if (!tweetId) throw new ApiError(400, "TweetId is required");
  if (!content) throw new ApiError(400, "Content is required");

  if (!isValidObjectId(tweetId)) throw new ApiError(400, "Invalid tweetId");

  const updatedTweet = await Tweet.findByIdAndUpdate(
    tweetId,
    {
      $set: {
        content,
      },
    },
    { new: true }
  );

  if (!updatedTweet) throw new ApiError(404, "Tweet not found");

  return res
    .status(200)
    .json(new ApiResponse(200, updatedTweet, "Tweet updated successfully"));
});

const deleteTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  if (!tweetId) throw new ApiError(400, "TweetId is required");

  if (!isValidObjectId(tweetId)) throw new ApiError(400, "Invalid tweetId");

  const deletedTweet = await Tweet.findByIdAndDelete(tweetId);

  if (!deletedTweet) throw new ApiError(404, "Tweet not found");

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Tweet deleted successfully"));
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };

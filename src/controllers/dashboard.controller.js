import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getChannelStats = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  try {
    const channelStat = await Video.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: "likes",
          localField: "_id",
          foreignField: "video",
          as: "Likes",
        },
      },
      {
        $lookup: {
          from: "subscriptions",
          localField: "owner",
          foreignField: "channel",
          as: "Subscribers",
        },
      },
      {
        $group: {
          _id: null,
          TotalVideos: { $sum: 1 },
          TotalViews: { $sum: "$views" },
          TotalSubscribers: { $first: { $size: "$Subscribers" } },
          TotalLikes: { $first: { $size: "$Likes" } },
        },
      },
      {
        $project: {
          _id: 0,
          TotalSubscribers: 1,
          TotalLikes: 1,
          TotalVideos: 1,
          TotalViews: 1,
        },
      },
    ]);

    if (!channelStat || channelStat.length === 0)
      throw new ApiError(500, "Unable to fetch the channel stat!");

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          channelStat[0],
          "Channel Stat fetched Successfully"
        )
      );
  } catch (error) {
    throw new ApiError(
      500,
      error?.message || "Unable to fetch the channel stat!!"
    );
  }
});

const getChannelVideos = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { page = 1, limit = 10 } = req.query;

  if (!userId) {
    throw new ApiError(400, "User ID is required");
  }

  // Parse and validate pagination parameters
  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);

  if (pageNumber <= 0)
    throw new ApiError(400, "Page number must be a positive integer");
  if (limitNumber <= 0)
    throw new ApiError(400, "Limit must be a positive integer");

  try {
    // Get the total count of videos for the user
    const totalVideos = await Video.countDocuments({
      owner: new mongoose.Types.ObjectId(userId),
    });

    // Fetch videos with pagination
    const videos = await Video.find({
      owner: new mongoose.Types.ObjectId(userId),
    })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .sort({ createdAt: -1 });

    // Respond with videos and pagination details
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          videos,
          totalVideos,
          currentPage: pageNumber,
          totalPages: Math.ceil(totalVideos / limitNumber),
        },
        "Channel videos fetched successfully"
      )
    );
  } catch (error) {
    // Handle any errors that occur during the fetching process
    throw new ApiError(500, error.message || "Unable to fetch channel videos");
  }
});

export { getChannelStats, getChannelVideos };

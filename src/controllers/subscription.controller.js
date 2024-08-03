import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const user = req.user;

  if (!channelId) throw new ApiError(400, "ChannelId is required");
  if (!isValidObjectId(channelId))
    throw new ApiError(400, "Invalid channel id");

  const existingSubscribed = await Subscription.findOne({
    channel: channelId,
    subscriber: user._id,
  });

  if (existingSubscribed) {
    await existingSubscribed.remove();

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Channel unsubscribed"));
  } else {
    const newSubscribed = new Subscription({
      subscriber: user._id,
      channel: channelId,
    });

    await newSubscribed.save();

    return res.status(200).json(200, newSubscribed, "Channel subscribed");
  }
});

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!channelId) throw new ApiError(400, "Channel id required");

  if (!isValidObjectId(channelId))
    throw new ApiError(400, "Invalid channel id");

  const subscribers = await Subscription.aggregate([
    {
      $match: {
        channel: mongoose.Types.ObjectId(channelId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "subscriber",
        foreignField: "_id",
        as: "subscriberDetails",
      },
    },
    {
      $unwind: "$subscriberDetails",
    },
    {
      $addFields: {
        userName: "$subscriberDetails.userName",
        avatar: "$subscriberDetails.avatar",
      },
    },
    {
      $project: {
        _id: 1,
        userName: 1,
        avatar: 1,
      },
    },
  ]);

  if (!subscribers) throw new ApiError(404, "No one subscribe this channel");

  return res
    .status(200)
    .json(
      new ApiResponse(200, subscribers, "Subscribers retrieved successfully")
    );
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;

  if (!subscriberId) throw new ApiError(400, "Subscriber id required");

  if (!isValidObjectId(subscriberId))
    throw new ApiError(400, "Invalid subscriber id");

  const channels = await Subscription.aggregate([
    {
      $match: {
        subscriber: mongoose.Types.ObjectId(subscriberId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "channelDetails",
      },
    },
    {
      $unwind: "$channelDetails",
    },
    {
      $addFields: {
        userName: "$channelDetails.userName",
        avatar: "$channelDetails.avatar",
      },
    },
    {
      $project: {
        _id: 1,
        userName: 1,
        avatar: 1,
      },
    },
  ]);

  if (!channels) throw new ApiError(404, "No channel subscribed");

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        channels,
        "Subscribed channel retrieved successfully"
      )
    );
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };

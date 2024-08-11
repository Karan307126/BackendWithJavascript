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
    await Subscription.deleteOne({ _id: existingSubscribed._id });

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Channel unsubscribed"));
  }
  const newSubscribed = new Subscription({
    subscriber: user._id,
    channel: channelId,
  });

  await newSubscribed.save();

  return res
    .status(200)
    .json(new ApiResponse(200, newSubscribed, "Channel subscribed"));
});

// Controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params; // Corrected variable name
  if (!channelId) {
    throw new ApiError(400, "Channel ID is required!");
  }

  try {
    const subscribers = await Subscription.aggregate([
      {
        $match: {
          channel: new mongoose.Types.ObjectId(channelId),
        },
      },
      {
        $group: {
          _id: "$channel",
          subscribers: { $push: "$subscriber" },
        },
      },
      {
        $project: {
          _id: 0,
          subscribers: 1,
        },
      },
    ]);

    if (!subscribers || subscribers.length === 0) {
      return res
        .status(200)
        .json(new ApiResponse(200, [], "No subscribers found for the channel"));
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          subscribers[0],
          "Subscribers fetched successfully!"
        )
      );
  } catch (e) {
    throw new ApiError(500, e?.message || "Unable to fetch subscribers!");
  }
});

// Controller to return channel list to which a user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params; // Corrected variable name
  if (!subscriberId) {
    throw new ApiError(400, "Subscriber ID is required!");
  }

  try {
    const subscribedChannels = await Subscription.aggregate([
      {
        $match: {
          subscriber: new mongoose.Types.ObjectId(subscriberId),
        },
      },
      {
        $group: {
          _id: "$subscriber",
          subscribedChannels: { $push: "$channel" },
        },
      },
      {
        $project: {
          _id: 0,
          subscribedChannels: 1,
        },
      },
    ]);

    if (!subscribedChannels || subscribedChannels.length === 0) {
      return res
        .status(200)
        .json(
          new ApiResponse(200, [], "No subscribed channels found for the user")
        );
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          subscribedChannels[0],
          "Subscribed channels fetched successfully!"
        )
      );
  } catch (e) {
    throw new ApiError(
      500,
      e?.message || "Unable to fetch subscribed channels!"
    );
  }
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };

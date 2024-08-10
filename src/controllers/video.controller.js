import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { deleteOnCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import { Comment } from "../models/comment.model.js";
import { Like } from "../models/like.model.js";
import { Playlist } from "../models/playlist.model.js";

const getAllVideos = asyncHandler(async (req, res) => {
  let { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;

  // Parse page and limit to numbers
  page = parseInt(page, 10);
  limit = parseInt(limit, 10);

  // Validate and adjust page and limit values
  page = Math.max(1, page); // Ensure page is at least 1
  limit = Math.min(20, Math.max(1, limit)); // Ensure limit is between 1 and 20

  // Validation for sortType
  if (sortType && !["asc", "desc"].includes(sortType.toLowerCase())) {
    throw new ApiError(400, "Invalid sortType, must be 'asc' or 'desc'");
  }

  const pipeline = [];

  // Match videos by owner userId if provided
  if (userId) {
    if (!isValidObjectId(userId)) {
      throw new ApiError(400, "userId is invalid");
    }

    pipeline.push({
      $match: {
        owner: mongoose.Types.ObjectId(userId),
      },
    });
  }

  // Match videos based on search query
  if (query) {
    pipeline.push({
      $match: {
        $text: {
          $search: query,
        },
      },
    });
  }

  // Sort pipeline stage based on sortBy and sortType
  const sortCriteria = {};
  if (sortBy) {
    sortCriteria[sortBy] = sortType === "asc" ? 1 : -1;
  } else {
    // Default sorting by createdAt if sortBy is not provided
    sortCriteria["createdAt"] = -1;
  }

  pipeline.push({
    $sort: sortCriteria,
  });

  // Apply pagination using skip and limit
  pipeline.push({
    $skip: (page - 1) * limit,
  });
  pipeline.push({
    $limit: limit,
  });

  // Execute aggregation pipeline
  const videos = await Video.aggregate(pipeline);

  // Return an empty array if no videos are found
  if (!videos || videos.length === 0) {
    return res.status(200).json(new ApiResponse(200, [], "No videos found"));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, videos, "Videos are fetched successfully"));
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  if (!title) throw new ApiError(400, "Video title is required");
  if (!description) throw new ApiError(400, "Video description is required");

  if (!req.files || !req.files.videoFile || !req.files.thumbnail) {
    throw new ApiError(400, "Video file and thumbnail are required");
  }

  const videoLocalPath = req.files?.videoFile[0]?.path;
  const thumbnailLocalPath = req.files?.thumbnail[0]?.path;

  if (!videoLocalPath) throw new ApiError(400, "Video is required!");
  if (!thumbnailLocalPath) throw new ApiError(400, "Thumbnail is required!");

  try {
    const video = await uploadOnCloudinary(videoLocalPath);
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if (!video?.url) {
      throw new ApiError(500, "Error occurred while uploading the video");
    }
    if (!thumbnail?.url) {
      throw new ApiError(500, "Error occurred while uploading the thumbnail");
    }

    const newVideo = new Video({
      videoFile: video.url,
      thumbnail: thumbnail.url,
      title,
      description,
      duration: video.duration,
      views: 0,
      isPublished: true,
      owner: req.user._id,
    });

    const savedVideo = await newVideo.save();

    return res
      .status(200)
      .json(new ApiResponse(200, savedVideo, "Video published successfully"));
  } catch (error) {
    throw new ApiError(
      500,
      error.message || "An error occurred while publishing the video"
    );
  }
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) throw new ApiError(400, "VideoId is required");
  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid videoId");

  const video = await Video.findById(videoId);

  if (!video) throw new ApiError(404, "Video is not found");

  if (!video.isPublished) {
    if (video.owner.toString() !== req.user._id.toString())
      throw new ApiError(404, "Video is not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Get video successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description } = req.body;

  // Validate videoId
  if (!videoId) throw new ApiError(400, "VideoId is required");
  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid videoId");

  // Validate title and description
  if (!title) throw new ApiError(400, "Title is required");
  if (!description) throw new ApiError(400, "Description is required");

  // Fetch video by id
  const video = await Video.findById(videoId);

  // Check if video exists
  if (!video) throw new ApiError(404, "Video not found");

  // Check if the requester is the owner of the video
  if (video.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(401, "You are not authorized to update this video");
  }

  let thumbnailUrl = video.thumbnail;
  if (req.file) {
    const thumbnailLocalPath = req.file.path;
    try {
      const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
      if (!thumbnail.url) {
        throw new ApiError(
          500,
          "Error while uploading thumbnail to Cloudinary"
        );
      }
      thumbnailUrl = thumbnail.url;
    } catch (error) {
      throw new ApiError(500, "Error while uploading thumbnail to Cloudinary");
    }
  }

  // Update the video details
  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        title,
        description,
        thumbnail: thumbnailUrl,
      },
    },
    {
      new: true,
    }
  );

  // Check if the update was successful
  if (!updatedVideo) {
    throw new ApiError(500, "Something went wrong while updating the details");
  }

  // Respond with the updated video data
  return res
    .status(200)
    .json(new ApiResponse(200, updatedVideo, "Video updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  // Validate videoId
  if (!videoId) throw new ApiError(400, "VideoId is required");
  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid videoId");

  // Fetch video by id
  const video = await Video.findById(videoId);

  // Check if video exists
  if (!video) throw new ApiError(404, "Video not found");

  // Check if the requester is the owner of the video
  if (video.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(401, "You are not authorized to delete this video");
  }

  // Delete video and thumbnail from Cloudinary
  await deleteOnCloudinary(video.videoFile);
  await deleteOnCloudinary(video.thumbnail);

  // Delete comments and likes associated with the video
  await Comment.deleteMany({ video: videoId });
  await Like.deleteMany({ video: videoId });

  // Remove the video from all playlists
  const playlists = await Playlist.updateMany(
    { videos: videoId },
    { $pull: { videos: videoId } }
  );

  // Delete the video document
  await Video.findByIdAndDelete(videoId);

  // Respond with success message
  return res
    .status(200)
    .json(new ApiResponse(200, null, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) throw new ApiError(400, "VideoId is required");
  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid videoId");

  const video = await Video.findById(videoId);

  if (!video) throw new ApiError(400, "Video is not found");

  if (video.owner.toString() !== req.user._id.toString())
    throw new ApiError(
      401,
      "You are not authorized to publish or unpublish this video"
    );

  const updatedVideo = await Video.findByIdAndUpdate(videoId, {
    $set: {
      isPublished: !video.isPublished,
    },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, updatedVideo, "Video updated successfully"));
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};

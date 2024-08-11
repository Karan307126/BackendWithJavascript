import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const userId = req.user._id;

  if (!userId) throw new ApiError(404, "User not found");
  if (!name) throw new ApiError(400, "Playlist name required");

  const newPlaylist = new Playlist({
    name,
    description,
    owner: userId,
    videos: [],
  });

  await newPlaylist.save();

  return res
    .status(200)
    .json(
      new ApiResponse(200, newPlaylist, "New Playlist created successfully")
    );
});

const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!userId) throw new ApiError(400, "User Id is required");
  if (!isValidObjectId(userId)) throw new ApiError(400, "Invalid UserId");

  const playlists = await Playlist.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
        description: 1,
        owner: 1,
        createdAt: 1,
        updatedAt: 1,
        videos: {
          $cond: {
            if: {
              $eq: ["$owner", new mongoose.Types.ObjectId(userId)],
            },
            then: "$videos",
            else: {
              $filter: {
                input: "$videos",
                as: "video",
                cond: {
                  $eq: ["$$video.isPublished", true],
                },
              },
            },
          },
        },
      },
    },
  ]);

  if (playlists.length === 0)
    return res
      .status(404)
      .json(new ApiResponse(404, null, "No playlists found for this user"));

  return res
    .status(200)
    .json(new ApiResponse(200, playlists, "Playlist get successfully"));
});

const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  if (!playlistId) throw new ApiError(400, "Playlist id is required");

  if (!isValidObjectId(playlistId))
    throw new ApiError(400, "Invalid playlist id");

  const playlist = await Playlist.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(playlistId),
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
        description: 1,
        owner: 1,
        createdAt: 1,
        updatedAt: 1,
        videos: {
          $cond: {
            if: {
              $eq: ["$owner", req.user._id], // Assuming req.user._id is the current logged-in user
            },
            then: "$videos",
            else: {
              $filter: {
                input: "$videos",
                as: "video",
                cond: {
                  $eq: ["$$video.isPublished", true],
                },
              },
            },
          },
        },
      },
    },
  ]);

  if (!playlist || playlist.length === 0)
    throw new ApiError(404, "Playlist not found");

  return res
    .status(200)
    .json(new ApiResponse(200, playlist[0], "Playlist retrieved successfully"));
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (!playlistId) throw new ApiError(400, "Playlist id required");

  if (!videoId) throw new ApiError(400, "Video id required");

  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video id");

  if (!isValidObjectId(playlistId))
    throw new ApiError(400, "Invalid playlist id");

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) throw new ApiError(404, "Playlist does't exists");

  playlist.videos.push(videoId);
  const updatedPlaylist = await playlist.save();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedPlaylist,
        "Video add to playlist successfully"
      )
    );
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (!playlistId) throw new ApiError(400, "Playlist id required");

  if (!videoId) throw new ApiError(400, "Video id required");

  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video id");

  if (!isValidObjectId(playlistId))
    throw new ApiError(400, "Invalid playlist id");

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) throw new ApiError(404, "Playlist does't exists");

  playlist.videos = playlist.videos.filter((video) => video != videoId);
  const updatedPlaylist = await playlist.save();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedPlaylist,
        "Remove video from playlist successfully"
      )
    );
});

const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  if (!playlistId) throw new ApiError(400, "Playlist id required");

  if (!isValidObjectId(playlistId))
    throw new ApiError(400, "Invalid playlist id");

  await Playlist.findByIdAndDelete(playlistId);

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Playlist deleted successfully"));
});

const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description } = req.body;

  if (!playlistId) throw new ApiError(400, "Playlist id required");

  if (!isValidObjectId(playlistId))
    throw new ApiError(400, "Invalid playlist id");

  const playlist = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      $set: {
        name,
        description,
      },
    },
    { new: true }
  );

  if (!playlist) throw new ApiError(404, "Playlist not found");

  return res
    .status(200)
    .json(new ApiResponse(200, playlist, "Playlist updated successfully"));
});

export {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  deletePlaylist,
  updatePlaylist,
};

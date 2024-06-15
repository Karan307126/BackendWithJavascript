import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { deleteOnCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
};

const generateAccessTokenAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while creating access token or refresh token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  /*
   1. Get User details from frontend
   2. Validation for empty field
   3. Check if User already exist by Username or Email
   4. Check for images -> Avatar check (Required)
   5. Upload images into cloudinary -> Avatar and CoverImage
   6. Create User object and create entry in db
   7. Remove password and refresh token from response
   8. Check for user creation
   9. return res to frontend
  */

  const { fullName, email, userName, password } = req.body;

  console.log("Body: ", req.body);

  if (
    [fullName, userName, password, email].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const isUserExist = await User.findOne({ $or: [{ userName }, { email }] });

  console.log("Is User Exists: ", isUserExist);

  if (isUserExist)
    throw new ApiError(409, "User with email or username is already existed");

  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

  console.log("Files (Avatar and CoverImage): ", req.files);

  if (!avatarLocalPath) throw new ApiError(400, "Avatar Image is required");

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) throw new ApiError(400, "Avatar Image is required");

  const user = await User.create({
    fullName,
    userName: userName.toLowerCase(),
    email,
    password,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser)
    throw ApiError(500, "Something went wrong while creating user");

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User created Successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  /* 
   1. Get login credentials from frontend
   2. Validate for empty field (userName or email and password)
   3. Check for if user exist or not (Find user based on userName or email)
   4. Check password match or not
   5. Generate the access token and refresh token
   6. Send access and refresh token in cookie
   7. Send response to the frontend with success
  */

  const { userName, email, password } = req.body;

  if (!(userName || email) && !password)
    throw new ApiError(400, "Username or email and password is required");

  const user = await User.findOne({
    $or: [{ email }, { userName }],
  });

  if (!user) throw new ApiError(404, "User dose not exists");

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) throw new ApiError(401, "Invalid login credentials");

  const { accessToken, refreshToken } =
    await generateAccessTokenAndRefreshToken(user._id);

  const loggedUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  return res
    .status(200)
    .cookie("accessToken", accessToken, COOKIE_OPTIONS)
    .cookie("refreshToken", refreshToken, COOKIE_OPTIONS)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedUser,
          accessToken,
          refreshToken,
        },
        "User loggedIn successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  /*
   1. Clear all cookie and clear refresh token
  */
  await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: { refreshToken: undefined },
    },
    {
      new: true,
    }
  );

  return res
    .status(200)
    .clearCookie("accessToken", COOKIE_OPTIONS)
    .clearCookie("refreshToken", COOKIE_OPTIONS)
    .json(new ApiResponse(200, {}, "User logged out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  /*
   1. Get refresh token from request cookie or body 
   2. Decode the refresh token and match with stored refresh token with database token
   3. Generate new refresh and access token 
  */

  const incomingRefreshToken =
    req.cookies.refreshToken || req.body?.refreshToken;

  if (!incomingRefreshToken) throw new ApiError(401, "Unauthorized request");

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) throw new ApiError(401, "Invalid refresh token");

    if (incomingRefreshToken !== user.refreshToken)
      throw new ApiError(401, "Refresh token is expired or used");

    const { newRefreshToken, accessToken } =
      await generateAccessTokenAndRefreshToken(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, COOKIE_OPTIONS)
      .cookie("refreshToken", newRefreshToken, COOKIE_OPTIONS)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            refreshToken: newRefreshToken,
          },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  /*
   1. Get old password and new password from frontend
   2. Check old password is correct or not
   3. Change password and save to database
   4. send response to frontend 
  */

  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) throw new ApiError(400, "Invalid old password");

  user.password = newPassword;

  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password change successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  /*
   1. Get changed data from frontend
   2. Check for empty fields 
   3. Find user and update the details on database
   4. send response to frontend
  */

  const { fullName, email } = req.body;

  if (!fullName || !email) throw new ApiError(400, "All fields are required");

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        fullName,
        email,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  /*
   1. Get new avatar file from frontend
   2. Delete old avatar file from cloudinary
   3. save new file on local server
   4. Upload new file on cloudinary
   5. Update database with new cloudinary url
   6. send response to frontend
  */

  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) throw new ApiError(400, "Avatar file is missing");

  const user = await User.findById(req.user?._id);

  if (!user) throw new ApiError(400, "User not found");

  await deleteOnCloudinary(user?.avatar);

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url)
    throw new ApiError(400, "Error while uploading on cloudinary");

  user.avatar = avatar.url;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar updated successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  /*
   Steps are same as avatar  
  */

  const coverImageLocalPath = req.file?.path;

  const user = await User.findById(req.user?._id);

  if (!user) throw new ApiError(400, "User not found");

  await deleteOnCloudinary(user?.coverImage);

  if (!coverImageLocalPath)
    throw new ApiError(400, "CoverImage file is missing");

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url)
    throw new ApiError(400, "Error while uploading on cloudinary");

  user.coverImage = coverImage.url;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, user, "CoverImage updated successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  /*
   1. Extract userName from the params
   2. Find the user based on userName
   3. Calculate the count of the subscribes base on channel field of subscription modal
   4. Calculate the count of subscribed channel count by this channel based on subscriber field of subscription modal
   5. Get the value for is user is subscribed or not to channel 
   6. Add all of the fields to the user modal through the join 
   7. Send response bake to frontend
  */

  const { userName } = req.params;

  if (!userName) throw new ApiError(400, "Username is not exists");

  const channel = await User.aggregate([
    {
      $match: {
        userName: userName.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        channelSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          if: { $in: [req.user?._id, subscribers.subscriber] },
          then: true,
          else: false,
        },
      },
    },
    {
      $project: {
        fullName: 1,
        userName: 1,
        email: 1,
        avatar: 1,
        coverImage: 1,
        subscribersCount: 1,
        channelSubscribedToCount: 1,
        isSubscribed: 1,
      },
    },
  ]);

  if (!channel?.length) throw new ApiError(400, "Channel does not exists");

  console.log("Channel : ", channel);

  return res
    .status(200)
    .json(new ApiResponse(200, channel[0], "Get channel profile successfully"));
});

const getUserWatchHistory = asyncHandler(async (req, res) => {
  /*
   1. Get user from the db using _id 
   2. Join the video document to the user document through watchHistory field
   3. Then again nested join video to user through owner field
   4. Extract the essential information
   5. Send as response to the frontend
  */

  const user = await User.aggregate([
    {
      $match: {
        _id: mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    userName: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "Watch history fetched successfully"
      )
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getUserWatchHistory,
};

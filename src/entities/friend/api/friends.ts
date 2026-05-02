import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../../../shared/api/firebase/firebase";
import { createFriendRequestNotification } from "../../notification";
import { getUserProfileById } from "../../user";
import {
  buildFriendshipId,
  getFriendId,
  normalizeFriendRequest,
  normalizeFriendship,
  type FriendProfile,
  type FriendRequestDocument,
  type FriendshipDocument,
  type NormalizedFriendRequest,
} from "../model/friend";

const FRIEND_REQUESTS_COLLECTION = "friendRequests";
const FRIENDS_COLLECTION = "friends";

type SendFriendRequestParams = {
  fromUserId: string;
  toUserId: string;
  fromUsername: string;
  toUsername: string;
};

type RespondToFriendRequestParams = {
  requestId: string;
  currentUserId: string;
  action: "accept" | "decline";
};

export async function getIncomingFriendRequests(userId: string) {
  const snapshot = await getDocs(
    query(collection(db, FRIEND_REQUESTS_COLLECTION), where("toUserId", "==", userId))
  );

  return snapshot.docs
    .map((item) => normalizeFriendRequest(item.id, item.data() as FriendRequestDocument))
    .sort(sortRequestsByCreatedAtDesc);
}

export async function getOutgoingFriendRequests(userId: string) {
  const snapshot = await getDocs(
    query(collection(db, FRIEND_REQUESTS_COLLECTION), where("fromUserId", "==", userId))
  );

  return snapshot.docs
    .map((item) => normalizeFriendRequest(item.id, item.data() as FriendRequestDocument))
    .sort(sortRequestsByCreatedAtDesc);
}

export async function getFriendProfiles(userId: string) {
  const snapshot = await getDocs(
    query(collection(db, FRIENDS_COLLECTION), where("userIds", "array-contains", userId))
  );

  const friendships = snapshot.docs
    .map((item) => normalizeFriendship(item.id, item.data() as FriendshipDocument))
    .filter((item) => item.userIds.length === 2);

  const friendIds = friendships
    .map((item) => getFriendId(item, userId))
    .filter(Boolean);

  const profiles = await Promise.all(friendIds.map((friendId) => getUserProfile(friendId)));

  return profiles
    .filter((item): item is FriendProfile => Boolean(item))
    .sort((left, right) => left.username.localeCompare(right.username, "ru"));
}

export async function sendFriendRequest(params: SendFriendRequestParams) {
  const fromUserId = params.fromUserId.trim();
  const toUserId = params.toUserId.trim();

  if (!fromUserId || !toUserId) {
    throw new Error("FRIEND_REQUEST_INVALID_USERS");
  }

  if (fromUserId === toUserId) {
    throw new Error("FRIEND_REQUEST_SELF");
  }

  const requestsRef = collection(db, FRIEND_REQUESTS_COLLECTION);
  const [outgoingPendingRequest, incomingPendingRequest] = await Promise.all([
    findPendingFriendRequest(fromUserId, toUserId),
    findPendingFriendRequest(toUserId, fromUserId),
  ]);

  if (outgoingPendingRequest || incomingPendingRequest) {
    throw new Error("FRIEND_REQUEST_ALREADY_EXISTS");
  }

  const nextRequestRef = doc(requestsRef);

  await runTransaction(db, async (transaction) => {
    transaction.set(nextRequestRef, {
      fromUserId,
      toUserId,
      fromUsername: params.fromUsername.trim(),
      toUsername: params.toUsername.trim(),
      status: "pending",
      createdAt: serverTimestamp(),
      respondedAt: null,
    });
  });

  const actorProfile = await getUserProfileById(fromUserId);
  await createFriendRequestNotification({
    userId: toUserId,
    actorUserId: fromUserId,
    actorUsername: params.fromUsername.trim(),
    actorAvatarDataUrl: actorProfile?.avatarDataUrl ?? "",
    friendRequestId: nextRequestRef.id,
  });
}

export async function cancelFriendRequest(requestId: string, currentUserId: string) {
  const requestRef = doc(db, FRIEND_REQUESTS_COLLECTION, requestId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(requestRef);
    if (!snapshot.exists()) {
      throw new Error("FRIEND_REQUEST_NOT_FOUND");
    }

    const request = normalizeFriendRequest(snapshot.id, snapshot.data() as FriendRequestDocument);
    if (request.status !== "pending") {
      throw new Error("FRIEND_REQUEST_NOT_PENDING");
    }

    if (request.fromUserId !== currentUserId) {
      throw new Error("FRIEND_REQUEST_CANCEL_DENIED");
    }

    transaction.update(requestRef, {
      status: "cancelled",
      respondedAt: serverTimestamp(),
    });
  });
}

export async function respondToFriendRequest(params: RespondToFriendRequestParams) {
  const requestRef = doc(db, FRIEND_REQUESTS_COLLECTION, params.requestId);

  await runTransaction(db, async (transaction) => {
    const requestSnapshot = await transaction.get(requestRef);
    if (!requestSnapshot.exists()) {
      throw new Error("FRIEND_REQUEST_NOT_FOUND");
    }

    const request = normalizeFriendRequest(requestSnapshot.id, requestSnapshot.data() as FriendRequestDocument);
    if (request.status !== "pending") {
      throw new Error("FRIEND_REQUEST_NOT_PENDING");
    }

    if (request.toUserId !== params.currentUserId) {
      throw new Error("FRIEND_REQUEST_RESPONSE_DENIED");
    }

    const friendshipId = buildFriendshipId(request.fromUserId, request.toUserId);
    const friendshipRef = doc(db, FRIENDS_COLLECTION, friendshipId);

    if (params.action === "accept") {
      transaction.set(friendshipRef, {
        userIds: [request.fromUserId, request.toUserId].sort(),
        createdAt: serverTimestamp(),
      });

      transaction.update(requestRef, {
        status: "accepted",
        respondedAt: serverTimestamp(),
      });

      return;
    }

    transaction.update(requestRef, {
      status: "declined",
      respondedAt: serverTimestamp(),
    });
  });
}

export async function removeFriend(currentUserId: string, friendUserId: string) {
  const friendshipRef = doc(db, FRIENDS_COLLECTION, buildFriendshipId(currentUserId, friendUserId));

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(friendshipRef);
    if (!snapshot.exists()) {
      throw new Error("FRIENDSHIP_NOT_FOUND");
    }

    transaction.delete(friendshipRef);
  });
}

export async function getFriendRequestState(currentUserId: string, targetUserId: string) {
  const pendingIncoming = await findPendingFriendRequest(targetUserId, currentUserId);
  if (pendingIncoming) {
    return {
      type: "incoming" as const,
      request: pendingIncoming,
    };
  }

  const pendingOutgoing = await findPendingFriendRequest(currentUserId, targetUserId);
  if (pendingOutgoing) {
    return {
      type: "outgoing" as const,
      request: pendingOutgoing,
    };
  }

  const friendshipSnapshot = await getDoc(
    doc(db, FRIENDS_COLLECTION, buildFriendshipId(currentUserId, targetUserId))
  );

  if (friendshipSnapshot.exists()) {
    return {
      type: "friends" as const,
      request: null,
    };
  }

  return {
    type: "none" as const,
    request: null,
  };
}

export async function getFriendRequestById(requestId: string) {
  const snapshot = await getDoc(doc(db, FRIEND_REQUESTS_COLLECTION, requestId));
  if (!snapshot.exists()) {
    return null;
  }

  return normalizeFriendRequest(snapshot.id, snapshot.data() as FriendRequestDocument);
}

async function findPendingFriendRequest(fromUserId: string, toUserId: string) {
  const snapshot = await getDocs(
    query(
      collection(db, FRIEND_REQUESTS_COLLECTION),
      where("fromUserId", "==", fromUserId),
      where("toUserId", "==", toUserId),
      limit(1)
    )
  );

  const docSnapshot = snapshot.docs.find((item) => {
    const request = normalizeFriendRequest(item.id, item.data() as FriendRequestDocument);
    return request.status === "pending";
  });
  if (!docSnapshot) {
    return null;
  }

  return normalizeFriendRequest(docSnapshot.id, docSnapshot.data() as FriendRequestDocument);
}

async function getUserProfile(userId: string) {
  return getUserProfileById(userId);
}

function sortRequestsByCreatedAtDesc(left: NormalizedFriendRequest, right: NormalizedFriendRequest) {
  return (right.createdAt?.getTime() ?? 0) - (left.createdAt?.getTime() ?? 0);
}

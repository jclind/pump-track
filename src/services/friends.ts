import {
  DocumentData,
  QueryDocumentSnapshot,
  collection,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
} from 'firebase/firestore'
import { getUIDFromUsername, getUsername } from './auth'
import { auth, db, firebaseFunctions } from './firestore'
import { CombinedFriendsData, FriendsData, UserProfileDataType } from '../types'
import toast from 'react-hot-toast'
import { httpsCallable } from 'firebase/functions'
import {
  FRIENDS,
  INCOMING_FRIEND_REQUESTS,
  OUTGOING_FRIEND_REQUESTS,
} from '../assets/globalVars/userProfileCollections'

const NOT_SIGNED_IN = 'You need to be signed in to do that.'
const USER_NOT_FOUND = "Couldn't find that user."

const callFunction = (name: string, data: object) =>
  httpsCallable(firebaseFunctions, name)(data)

const reportError = (error: unknown) => {
  console.log(error)
  const message = (error as { message?: string } | null)?.message
  toast.error(message || String(error), { position: 'bottom-center' })
}

export const getFriendshipStatus = async (friendUsername: string) => {
  const currUID = auth?.currentUser?.uid
  const friendUID = await getUIDFromUsername(friendUsername)

  if (currUID && friendUID) {
    const cloudGetFriendshipStatus = httpsCallable(
      firebaseFunctions,
      'getFriendshipStatus'
    )
    const statusRes: any = await cloudGetFriendshipStatus({
      currUID,
      friendUID,
    })

    const status = statusRes.data

    if (['friends', 'incoming', 'outgoing', 'not_friends'].includes(status)) {
      return status
    }
    return undefined
  }
}
// The friend actions below throw on failure, so the buttons that call them
// can undo their optimistic state. The functions send any emails themselves.
export const addFriend = async (friendUsername: string) => {
  const uid = auth?.currentUser?.uid
  const currUsername = await getUsername()
  const friendUID = await getUIDFromUsername(friendUsername)
  if (!uid || !currUsername) throw new Error(NOT_SIGNED_IN)
  if (!friendUID) throw new Error(USER_NOT_FOUND)
  await callFunction('addFriend', {
    currUID: uid,
    friendUID,
    currUsername,
    friendUsername,
  })
}
export const removeFriend = async (friendUID: string) => {
  const uid = auth?.currentUser?.uid
  if (!uid) throw new Error(NOT_SIGNED_IN)
  await callFunction('removeFriend', { currUID: uid, friendUID })
}
export const acceptFriendRequest = async (friendUsername: string) => {
  const currUID = auth?.currentUser?.uid
  const currUsername = await getUsername()
  const friendUID = await getUIDFromUsername(friendUsername)
  if (!currUID || !currUsername) throw new Error(NOT_SIGNED_IN)
  if (!friendUID) throw new Error(USER_NOT_FOUND)
  await callFunction('acceptFriendRequest', {
    currUID,
    currUsername,
    friendUID,
    friendUsername,
  })
}
export const removeIncomingRequest = async (friendUsername: string) => {
  const uid = auth?.currentUser?.uid
  const friendUID = await getUIDFromUsername(friendUsername)
  if (!uid) throw new Error(NOT_SIGNED_IN)
  if (!friendUID) throw new Error(USER_NOT_FOUND)
  await callFunction('removeIncomingRequest', { currUID: uid, friendUID })
}

const getListFromFriendsCollection = async (
  uid: string,
  collectionName: string,
  limitNum: number,
  lastDoc: QueryDocumentSnapshot<DocumentData, DocumentData> | null = null,
  { countFriends = false } = {}
): Promise<
  | {
      friends: FriendsData[]
      numFriends: number
      newLastDoc: QueryDocumentSnapshot<DocumentData, DocumentData> | null
    }
  | undefined
> => {
  try {
    const userProfileRef = doc(db, 'userProfileData', uid)
    const userFriendsRef = collection(userProfileRef, `${collectionName}`)

    let q = query(userFriendsRef, orderBy('date', 'desc'), limit(limitNum))
    if (lastDoc) {
      q = query(q, startAfter(lastDoc))
    }
    const userFriendsSnapshot = await getDocs(q)
    const numFriends = countFriends ? await countFriendsOf(uid) : 0
    const friends: FriendsData[] = []
    const newLastDoc =
      userFriendsSnapshot.docs[userFriendsSnapshot.docs.length - 1]
    userFriendsSnapshot.forEach(doc => {
      friends.push(doc.data() as FriendsData)
    })

    return {
      friends,
      numFriends,
      newLastDoc,
    }
  } catch (error) {
    reportError(error)
  }
}
const getAndCombineFriendsData = async (
  friends: FriendsData[]
): Promise<CombinedFriendsData[]> => {
  const cloudGetUsersFriendData = httpsCallable(
    firebaseFunctions,
    'getUsersFriendData'
  )
  const combinedUsers: any = await cloudGetUsersFriendData({
    usersFriendList: friends,
  })
  const combinedUsersData = combinedUsers.data as CombinedFriendsData[]

  return combinedUsersData
}

export const getFriends = async <B extends boolean | undefined>(
  lastDoc: QueryDocumentSnapshot<DocumentData, DocumentData> | null = null,
  options?: {
    returnUserData?: B
  }
): Promise<
  B extends true
    ? {
        friendsData: CombinedFriendsData[]
        numFriends: number
        lastDoc: QueryDocumentSnapshot<DocumentData, DocumentData> | null
      }
    : {
        friendsData: FriendsData[]
        numFriends: number
        lastDoc: QueryDocumentSnapshot<DocumentData, DocumentData> | null
      }
> => {
  try {
    const uid = auth?.currentUser?.uid
    if (uid) {
      const friendsListRes = await getListFromFriendsCollection(
        uid,
        FRIENDS,
        10,
        lastDoc,
        { countFriends: true }
      )
      if (!friendsListRes) {
        throw new Error('Something went wrong')
      }

      const { friends, numFriends, newLastDoc } = friendsListRes

      if (options?.returnUserData) {
        const combinedUsersData = await getAndCombineFriendsData(friends)
        const returnData = {
          friendsData: combinedUsersData,
          lastDoc: newLastDoc,
          numFriends,
        }
        return returnData
      } else {
        const returnData = {
          friendsData: friends as any,
          lastDoc: newLastDoc,
          numFriends,
        }
        return returnData
      }
    }
  } catch (error) {
    reportError(error)
  }

  return { friendsData: [], lastDoc: null, numFriends: 0 }
}
const countFriendsOf = async (uid: string) => {
  const userProfileDataRef = doc(db, 'userProfileData', uid)
  const friendsCollection = collection(userProfileDataRef, `${FRIENDS}`)
  const totalResultsSnapshot = await getCountFromServer(friendsCollection)
  return totalResultsSnapshot.data().count
}
export const getNumberOfFriends = async (username: string | null = null) => {
  try {
    const uid = username
      ? await getUIDFromUsername(username)
      : auth?.currentUser?.uid
    if (uid) {
      return await countFriendsOf(uid)
    }
  } catch (error) {
    reportError(error)
  }
}
export const getSuggestedFriends = async () => {
  try {
    const uid = auth?.currentUser?.uid
    if (uid) {
      const cloudGetSuggestedFriends = httpsCallable(
        firebaseFunctions,
        'getSuggestedFriends'
      )
      const suggestedFriendsRes = await cloudGetSuggestedFriends({ uid })
      const suggestedFriendsData =
        suggestedFriendsRes.data as UserProfileDataType[]
      return suggestedFriendsData
    }
  } catch (error) {
    reportError(error)
  }
}
export const getIncomingFriendRequests = async () => {
  try {
    const uid = auth?.currentUser?.uid
    if (uid) {
      const friendsListRes = await getListFromFriendsCollection(
        uid,
        INCOMING_FRIEND_REQUESTS,
        20
      )
      if (!friendsListRes) throw new Error('Something went wrong')
      const { friends: incomingFriendRequests } = friendsListRes

      const combinedUsersData = await getAndCombineFriendsData(
        incomingFriendRequests
      )

      return combinedUsersData as CombinedFriendsData[]
    }
  } catch (error) {
    reportError(error)
  }
}
export const getOutgoingFriendRequests = async () => {
  try {
    const uid = auth?.currentUser?.uid
    if (uid) {
      const friendsListRes = await getListFromFriendsCollection(
        uid,
        OUTGOING_FRIEND_REQUESTS,
        20
      )
      if (!friendsListRes) throw new Error('Something went wrong')
      const { friends: outgoingFriendRequests } = friendsListRes

      const combinedUsersData = await getAndCombineFriendsData(
        outgoingFriendRequests
      )

      return combinedUsersData as CombinedFriendsData[]
    }
  } catch (error) {
    reportError(error)
  }
}

// Profile pages and the suggestions list know the friend by username, but
// removeOutgoingRequest needs their UID.
export const cancelFriendRequest = async (friendUsername: string) => {
  const friendUID = await getUIDFromUsername(friendUsername)
  return removeOutgoingRequest(friendUID)
}

export const removeOutgoingRequest = async (friendUID: string) => {
  const uid = auth?.currentUser?.uid
  if (!uid) throw new Error(NOT_SIGNED_IN)
  if (!friendUID) throw new Error(USER_NOT_FOUND)
  await callFunction('removeOutgoingRequest', { currUID: uid, friendUID })
}
export const getNumIncoming = async () => {
  try {
    const uid = auth?.currentUser?.uid
    if (uid) {
      const userProfileDataRef = doc(db, 'userProfileData', uid)
      const incomingFriendRequestsCollection = collection(
        userProfileDataRef,
        `${INCOMING_FRIEND_REQUESTS}`
      )
      const totalResultsSnapshot = await getCountFromServer(
        incomingFriendRequestsCollection
      )
      const totalResults = totalResultsSnapshot.data().count
      return totalResults
    }
  } catch (error) {
    reportError(error)
  }
}

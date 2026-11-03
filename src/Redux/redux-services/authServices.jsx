// Kept out of AuthReducer, as in the subscriber app. authAPI is imported lazily:
// authAPI -> axios -> store -> AuthReducer would otherwise be a circular import,
// and whichever module loads first would see the other half-initialised.
// Never throws: a failure is returned as { status } so the thunk can react to it.
export const fetchUserInfoFromAPI = async () => {
  try {
    const { getMe } = await import("../../core/apis/authAPI");
    return await getMe();
  } catch (error) {
    return { status: error?.response?.status || 400 };
  }
};

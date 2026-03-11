const getFeed = async ({ client, feedId }) => {
  const response = await client.callAPI({
    operation: "getFeed",
    endpoint: "feeds",
    path: {
      feedId,
    },
  });
  return response;
};
export default getFeed;

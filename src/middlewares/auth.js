const { SPECIAL_ACCESS_AUTH_TOKEN } = process.env;

const authenticateSpecialToken = (req, res, next) => {
  const { authorization } = req.headers;
  if (authorization !== SPECIAL_ACCESS_AUTH_TOKEN) {
    return res.status(401).json({
      message: "missing special access auth token",
    });
  }
  next();
};


export {
  authenticateSpecialToken
};

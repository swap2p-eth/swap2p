import {
  ContractFunctionExecutionError,
  UserRejectedRequestError
} from "viem";

const USER_REJECTED_REGEX = /user rejected/i;

export function isUserRejectedError(error: unknown): boolean {
  if (!error) return false;

  if (error instanceof UserRejectedRequestError) {
    return true;
  }

  if (error instanceof ContractFunctionExecutionError) {
    if (error.cause && isUserRejectedError(error.cause)) {
      return true;
    }
    if (typeof error.shortMessage === "string" && USER_REJECTED_REGEX.test(error.shortMessage)) {
      return true;
    }
  }

  if (error instanceof Error) {
    return USER_REJECTED_REGEX.test(error.message);
  }

  if (typeof error === "string") {
    return USER_REJECTED_REGEX.test(error);
  }

  return false;
}

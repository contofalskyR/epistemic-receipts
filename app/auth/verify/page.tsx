export default function VerifyPage() {
  return (
    <div className="max-w-xs space-y-4">
      <h1 className="text-lg font-semibold text-white">Check your email</h1>
      <p className="text-sm text-gray-400">
        A sign-in link was sent to your email. It expires in 15 minutes and can only be used once.
      </p>
      <p className="text-xs text-gray-600">
        Didn&rsquo;t get it? Check your spam folder or{" "}
        <a href="/auth/signin" className="underline text-gray-400">try again</a>.
      </p>
    </div>
  );
}

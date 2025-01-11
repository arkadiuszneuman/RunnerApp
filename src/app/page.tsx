import Link from "next/link";
import BleConnector from "./BleConnector";

export default function Home() {
  return (
    <>
      <Link href="/test">Link</Link>
      <BleConnector />
    </>
  );
}

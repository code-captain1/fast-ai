import { Button } from "./ui/button";
import Image from "next/image";

export default function Header() {
  return (
    <header className="flex flex-row justify-between items-center p-2 bg-zinc-200 rounded-2xl gap-4 w-[50%] fixed top-5 ">
      <div className="flex flex-row gap-1 items-center">
        <Image
          src="/assets/favicon/favicon.ico"
          alt="profile"
          width={10}
          height={10}
          className="w-auto h-auto"
        />
        <h1 className="font-bold text-xl">Fast AI</h1>
      </div>

      <ul className="flex flex-row gap-2 ">
        <li>
          <Button>Products</Button>
        </li>
        <li>
          <Button>Accounts</Button>
        </li>
        <li>
          <Button>Sign In</Button>
        </li>
      </ul>
    </header>
  );
}

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { supabase } from "@/lib/supabase";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

function Signup() {

  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {

    e.preventDefault();

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Signup successful!");

    navigate("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">

      <Card className="w-[400px]">

        <CardContent className="p-6">

          <h1 className="text-3xl font-bold mb-6">
            Create Account
          </h1>

          <form
            onSubmit={handleSignup}
            className="space-y-4"
          >

            <div>
              <Label>Email</Label>

              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
              />
            </div>

            <div>
              <Label>Password</Label>

              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
              />
            </div>

            <Button
              className="w-full"
              disabled={loading}
            >
              {
                loading
                  ? "Creating..."
                  : "Signup"
              }
            </Button>

          </form>

          <p className="mt-4 text-sm text-center">
            Already have an account?

            <Link
              to="/"
              className="text-blue-600 ml-1"
            >
              Login
            </Link>
          </p>

        </CardContent>

      </Card>

    </div>
  );
}

export default Signup;
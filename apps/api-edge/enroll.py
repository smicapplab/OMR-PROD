import httpx
import sys
import os
from pathlib import Path

def enroll():
    cloud_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4000"
    
    # Get MACHINE_ID from env
    machine_id = os.getenv("MACHINE_ID", "DEV-MACHINE-001")

    print(f"🚀 Registering appliance '{machine_id}' with National Hub at {cloud_url}...")
    
    try:
        response = httpx.post(
            f"{cloud_url}/api/v1/sync/register",
            json={
                "machineId": machine_id
            },
            timeout=30.0
        )
        
        if response.status_code == 201 or response.status_code == 200:
            data = response.json()
            secret = data["machineSecret"]
            status = data["status"]
            
            print(f"✅ Registration request sent!")
            print(f"📡 Current Status: {status.upper()}")
            
            if status == 'pending':
                print("⏳ Please ask a National Administrator to APPROVE this machine in the portal.")
            
            # Save to .env file in api-edge directory
            env_path = Path(__file__).parent / ".env"
            
            lines = []
            if env_path.exists():
                with open(env_path, "r") as f:
                    lines = f.readlines()
            
            new_lines = []
            secret_updated = False
            for line in lines:
                if line.startswith("MACHINE_SECRET="):
                    new_lines.append(f"MACHINE_SECRET={secret}\n")
                    secret_updated = True
                else:
                    new_lines.append(line)
            
            if not secret_updated:
                new_lines.append(f"MACHINE_SECRET={secret}\n")
                
            with open(env_path, "w") as f:
                f.writelines(new_lines)
                
            print(f"💾 Machine secret saved locally.")
            print("\n⚠️  Restart the edge API once approved.")
            
        else:
            print(f"❌ Registration failed ({response.status_code}): {response.text}")
            
    except Exception as e:
        print(f"❌ Error during registration: {e}")

if __name__ == "__main__":
    enroll()

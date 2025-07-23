#!/usr/bin/env python3
"""
Simple PostgreSQL Connection Test
Tests different connection methods to find the working one
"""

import os
import sys

def test_psycopg2_connection():
    """Test connection using psycopg2"""
    try:
        import psycopg2
        print("🧪 Testing psycopg2 connection...")
        
        # Test different hosts
        hosts_to_try = ["localhost", "127.0.0.1", "172.22.0.2"]
        
        for host in hosts_to_try:
            try:
                print(f"🔄 Trying {host}:5432...")
                conn = psycopg2.connect(
                    host=host,
                    port=5432,
                    database="pizza_violations",
                    user="pizza_admin",
                    password="secure_pizza_2024"
                )
                print(f"✅ psycopg2 connection successful to {host}!")
                
                # Test a simple query
                cursor = conn.cursor()
                cursor.execute("SELECT version();")
                version = cursor.fetchone()
                print(f"📊 PostgreSQL version: {version[0]}")
                
                cursor.close()
                conn.close()
                return host
                
            except Exception as e:
                print(f"❌ Failed to connect to {host}: {e}")
                continue
        
        print("❌ All psycopg2 connection attempts failed")
        return None
        
    except ImportError:
        print("❌ psycopg2 not installed. Installing...")
        os.system("pip install psycopg2-binary")
        return test_psycopg2_connection()

def test_asyncpg_connection():
    """Test connection using asyncpg"""
    try:
        import asyncio
        import asyncpg
        
        async def test_async_connection():
            print("🧪 Testing asyncpg connection...")
            
            hosts_to_try = ["localhost", "127.0.0.1", "172.22.0.2"]
            
            for host in hosts_to_try:
                try:
                    print(f"🔄 Trying asyncpg to {host}:5432...")
                    conn = await asyncpg.connect(
                        host=host,
                        port=5432,
                        database="pizza_violations",
                        user="pizza_admin",
                        password="secure_pizza_2024"
                    )
                    print(f"✅ asyncpg connection successful to {host}!")
                    
                    # Test a simple query
                    version = await conn.fetchval("SELECT version();")
                    print(f"📊 PostgreSQL version: {version}")
                    
                    await conn.close()
                    return host
                    
                except Exception as e:
                    print(f"❌ Failed asyncpg connection to {host}: {e}")
                    continue
            
            print("❌ All asyncpg connection attempts failed")
            return None
        
        return asyncio.run(test_async_connection())
        
    except ImportError:
        print("❌ asyncpg not installed")
        return None

def main():
    """Main test function"""
    print("🍕 PostgreSQL Connection Test")
    print("=" * 50)
    
    # Test psycopg2 first (simpler)
    working_host = test_psycopg2_connection()
    
    if working_host:
        print(f"\n✅ Working host found: {working_host}")
        print(f"💡 Use this in your database service:")
        print(f"   set DB_HOST={working_host}")
        
        # Test asyncpg with the working host
        print(f"\n🧪 Testing asyncpg with working host...")
        asyncpg_host = test_asyncpg_connection()
        
        if asyncpg_host:
            print(f"✅ Both psycopg2 and asyncpg work with {working_host}")
            print(f"\n🚀 Ready to start database service!")
            print(f"Run: set DB_HOST={working_host} && python main.py")
        else:
            print(f"⚠️ psycopg2 works but asyncpg doesn't. Check asyncpg installation.")
    else:
        print("\n❌ No working PostgreSQL connection found")
        print("💡 Troubleshooting steps:")
        print("1. Check if PostgreSQL container is running: docker ps | findstr postgres")
        print("2. Check container logs: docker logs pizza_violations_db")
        print("3. Try restarting container: docker restart pizza_violations_db")

if __name__ == "__main__":
    main()
